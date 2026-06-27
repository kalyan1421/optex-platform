import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * VAT rate applied to the (post-discount) cart subtotal. Optex Opticians is
 * VAT-registered in Kenya, where the standard rate is 16% — this mirrors the
 * `0.16` figure documented on the `orders` schema and used in the orders query
 * helper (`packages/db/src/queries/orders.ts`).
 */
const VAT_RATE = 0.16;

/** A single cart line joined to its product (name, price, image). */
export interface CartItemView {
  id: string;
  productId: string;
  quantity: number;
  lensOption: unknown | null;
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string | null;
    priceKes: number;
    image: string | null;
  };
  lineTotalKes: number;
}

/** Applied-promo summary embedded in the cart view. */
export interface AppliedPromoView {
  code: string;
  discountType: 'percent' | 'fixed';
  value: number;
  discountKes: number;
}

/** Fully-computed cart returned by every cart endpoint. */
export interface CartView {
  cartId: string;
  items: CartItemView[];
  itemCount: number;
  subtotalKes: number;
  promo: AppliedPromoView | null;
  discountKes: number;
  vatKes: number;
  totalKes: number;
}

/** Minimal `cart_items` row shape as returned by Supabase. */
interface CartItemRow {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
}

/** Minimal `promo_codes` row shape (mirrors the Supabase schema). */
interface PromoCodeRow {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  value: number;
  category_id: string | null;
  max_uses: number | null;
  uses: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

/** Round a KES amount to 2 decimal places. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Server-side cart logic for the storefront. Uses the privileged service-role
 * Supabase client (`this.supabase.client`, RLS-bypassing) so ownership is
 * enforced in code: every cart/item is resolved through the caller's
 * `customers.id` (looked up from the JWT's `auth_user_id`).
 */
@Injectable()
export class CartService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Applied promo codes keyed by cart id.
   *
   * ASSUMPTION: the `carts` table has no column to persist an applied promo
   * (only `id`, `customer_id`, `updated_at` across migrations 0001-0007). Per
   * the contract's fallback ("else just recompute"), the applied code is held
   * in process memory so apply/clear/get behave consistently within a running
   * instance. This is not durable across restarts or multiple instances; when
   * a `carts.promo_code` column is added, swap this Map for a column write.
   */
  private readonly appliedPromos = new Map<string, string>();

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Get-or-create the caller's cart and return it fully computed. */
  async getCart(authUserId: string): Promise<CartView> {
    const cartId = await this.getOrCreateCartId(authUserId);
    return this.buildCartView(cartId);
  }

  /** Add a product to the caller's cart, or increment if already present. */
  async addItem(
    authUserId: string,
    productId: string,
    quantity: number,
  ): Promise<CartView> {
    const cartId = await this.getOrCreateCartId(authUserId);
    const qty = Math.max(1, Math.trunc(quantity || 1));

    // Confirm the product exists and is purchasable before touching the cart.
    const { data: product, error: productError } = await this.supabase.client
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('is_active', true)
      .maybeSingle();
    if (productError) throw new BadRequestException(productError.message);
    if (!product) {
      throw new NotFoundException(`Product "${productId}" is not available`);
    }

    // Match an existing line for the same product with a null lens_option (the
    // storefront cart does not yet send per-line lens configuration).
    const { data: existing, error: selectError } = await this.supabase.client
      .from('cart_items')
      .select('id')
      .eq('cart_id', cartId)
      .eq('product_id', productId)
      .is('lens_option', null)
      .maybeSingle();
    if (selectError) throw new BadRequestException(selectError.message);

    if (existing) {
      await this.incrementItem((existing as { id: string }).id, qty);
      return this.buildCartView(cartId);
    }

    const { error: insertError } = await this.supabase.client
      .from('cart_items')
      .insert({ cart_id: cartId, product_id: productId, quantity: qty });

    if (insertError) {
      // 23505 = unique_violation on (cart_id, product_id, lens_option): a
      // concurrent request inserted the same line first. Recover by atomically
      // incrementing the winning row (D-3 race fix mirrored from cart.ts).
      if ((insertError as { code?: string }).code === '23505') {
        const { data: winner, error: raceError } = await this.supabase.client
          .from('cart_items')
          .select('id')
          .eq('cart_id', cartId)
          .eq('product_id', productId)
          .is('lens_option', null)
          .maybeSingle();
        if (raceError) throw new BadRequestException(raceError.message);
        if (winner) {
          await this.incrementItem((winner as { id: string }).id, qty);
          return this.buildCartView(cartId);
        }
      }
      throw new BadRequestException(insertError.message);
    }

    return this.buildCartView(cartId);
  }

  /** Set the absolute quantity of a line (removing it when ≤ 0). */
  async updateItem(
    authUserId: string,
    itemId: string,
    quantity: number,
  ): Promise<CartView> {
    const cartId = await this.getOrCreateCartId(authUserId);
    await this.assertItemBelongsToCart(itemId, cartId);

    if (quantity <= 0) {
      const { error } = await this.supabase.client
        .from('cart_items')
        .delete()
        .eq('id', itemId)
        .eq('cart_id', cartId);
      if (error) throw new BadRequestException(error.message);
      return this.buildCartView(cartId);
    }

    const { error } = await this.supabase.client
      .from('cart_items')
      .update({ quantity: Math.trunc(quantity) })
      .eq('id', itemId)
      .eq('cart_id', cartId);
    if (error) throw new BadRequestException(error.message);

    return this.buildCartView(cartId);
  }

  /** Remove a line from the caller's cart (ownership-checked). */
  async removeItem(authUserId: string, itemId: string): Promise<CartView> {
    const cartId = await this.getOrCreateCartId(authUserId);
    await this.assertItemBelongsToCart(itemId, cartId);

    const { error } = await this.supabase.client
      .from('cart_items')
      .delete()
      .eq('id', itemId)
      .eq('cart_id', cartId);
    if (error) throw new BadRequestException(error.message);

    return this.buildCartView(cartId);
  }

  /**
   * Validate and apply a promo code to the caller's cart. Throws
   * `BadRequestException` with the reason when the code is unusable.
   */
  async applyPromo(authUserId: string, code: string): Promise<CartView> {
    const cartId = await this.getOrCreateCartId(authUserId);
    const normalized = code.trim().toUpperCase();

    const { data, error } = await this.supabase.client
      .from('promo_codes')
      .select(
        'id, code, discount_type, value, category_id, max_uses, uses, starts_at, expires_at, is_active',
      )
      .eq('code', normalized)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException('Failed to look up promo code');
    }
    if (!data) {
      throw new BadRequestException('Promo code not found.');
    }

    const promo = data as PromoCodeRow;
    const now = Date.now();

    if (!promo.is_active) {
      throw new BadRequestException('This promo code is no longer active.');
    }
    if (promo.starts_at && new Date(promo.starts_at).getTime() > now) {
      throw new BadRequestException('This promo code is not yet valid.');
    }
    if (promo.expires_at && new Date(promo.expires_at).getTime() < now) {
      throw new BadRequestException('This promo code has expired.');
    }
    if (promo.max_uses !== null && promo.uses >= promo.max_uses) {
      throw new BadRequestException(
        'This promo code has reached its usage limit.',
      );
    }

    this.appliedPromos.set(cartId, promo.code);
    return this.buildCartView(cartId);
  }

  /** Clear any applied promo from the caller's cart. */
  async clearPromo(authUserId: string): Promise<CartView> {
    const cartId = await this.getOrCreateCartId(authUserId);
    this.appliedPromos.delete(cartId);
    return this.buildCartView(cartId);
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  /**
   * Resolve the caller's `customers.id` from the JWT `auth_user_id`.
   *
   * CRITICAL: the JWT `user.id` equals `customers.auth_user_id`, NOT
   * `customers.id`. Cart rows reference `customers.id`, so we must translate.
   */
  private async resolveCustomerId(authUserId: string): Promise<string> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) {
      throw new NotFoundException('No customer profile for the current user');
    }
    return (data as { id: string }).id;
  }

  /**
   * Get-or-create the caller's cart and return its id.
   *
   * D-3 FIX: the original select-then-insert pattern races when two tabs open
   * at once (both see no cart, both INSERT, one hits the unique constraint on
   * `carts.customer_id`). We upsert with ON CONFLICT DO NOTHING and then always
   * re-select, so concurrent callers converge on the same row.
   */
  private async getOrCreateCartId(authUserId: string): Promise<string> {
    const customerId = await this.resolveCustomerId(authUserId);

    const { error: upsertError } = await this.supabase.client
      .from('carts')
      .upsert(
        { customer_id: customerId },
        { onConflict: 'customer_id', ignoreDuplicates: true },
      );
    if (upsertError) throw new BadRequestException(upsertError.message);

    const { data: cart, error } = await this.supabase.client
      .from('carts')
      .select('id')
      .eq('customer_id', customerId)
      .single();
    if (error) throw new BadRequestException(error.message);
    return (cart as { id: string }).id;
  }

  /** Throw `ForbiddenException` if the item is not in the caller's cart. */
  private async assertItemBelongsToCart(
    itemId: string,
    cartId: string,
  ): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('cart_items')
      .select('id, cart_id')
      .eq('id', itemId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) {
      throw new NotFoundException(`Cart item "${itemId}" not found`);
    }
    if ((data as CartItemRow).cart_id !== cartId) {
      throw new ForbiddenException('This cart item does not belong to you');
    }
  }

  /**
   * Atomically increment a line's quantity via the `increment_cart_item_qty`
   * RPC (migration 0007). Serialised by Postgres, so concurrent "+1" requests
   * never lose an increment (H-6 fix mirrored from cart.ts).
   */
  private async incrementItem(itemId: string, delta: number): Promise<void> {
    const { error } = await this.supabase.client.rpc(
      'increment_cart_item_qty',
      { item_id: itemId, delta },
    );
    if (error) throw new BadRequestException(error.message);
  }

  /**
   * Hydrate the cart with product details, look up any applied promo, and
   * compute subtotal, discount, VAT, and total.
   *
   * VAT is charged on the post-discount taxable base (subtotal − discount),
   * matching Kenya VAT treatment; the discount math mirrors the promotions
   * module and the VAT/total arithmetic mirrors the orders query helper.
   */
  private async buildCartView(cartId: string): Promise<CartView> {
    const { data, error } = await this.supabase.client
      .from('cart_items')
      .select(
        `
        id,
        cart_id,
        product_id,
        quantity,
        lens_option,
        product:products!inner ( id, slug, name, brand, images, price_kes )
        `,
      )
      .eq('cart_id', cartId)
      .order('id', { ascending: true });
    if (error) throw new BadRequestException(error.message);

    type RawJoin = {
      id: string;
      cart_id: string;
      product_id: string;
      quantity: number;
      lens_option: unknown | null;
      product: {
        id: string;
        slug: string;
        name: string;
        brand: string | null;
        images: string[] | null;
        price_kes: number;
      } | null;
    };

    const rows = (data ?? []) as unknown as RawJoin[];

    // Drop rows whose product was deleted out from under us rather than
    // crashing the cart on render (defensive, mirrors cart.ts).
    const items: CartItemView[] = rows
      .filter((r) => r.product !== null)
      .map((r) => {
        const product = r.product!;
        const priceKes = Number(product.price_kes);
        return {
          id: r.id,
          productId: r.product_id,
          quantity: r.quantity,
          lensOption: r.lens_option ?? null,
          product: {
            id: product.id,
            slug: product.slug,
            name: product.name,
            brand: product.brand,
            priceKes,
            image: product.images?.[0] ?? null,
          },
          lineTotalKes: round2(priceKes * r.quantity),
        };
      });

    const subtotalKes = round2(
      items.reduce((sum, i) => sum + i.product.priceKes * i.quantity, 0),
    );
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

    const { promo, discountKes } = await this.resolveAppliedPromo(
      cartId,
      subtotalKes,
    );

    // VAT on the discounted taxable base; total = base + VAT (no shipping at
    // the cart stage — shipping is added at checkout in the orders module).
    const taxableBase = round2(subtotalKes - discountKes);
    const vatKes = round2(taxableBase * VAT_RATE);
    const totalKes = round2(taxableBase + vatKes);

    return {
      cartId,
      items,
      itemCount,
      subtotalKes,
      promo,
      discountKes,
      vatKes,
      totalKes,
    };
  }

  /**
   * Resolve the cart's currently-applied promo (if any) and compute its
   * discount against the supplied subtotal. Re-validates the code on every read
   * so an expired/exhausted code silently stops discounting; an invalid code is
   * dropped from the in-memory store.
   */
  private async resolveAppliedPromo(
    cartId: string,
    subtotalKes: number,
  ): Promise<{ promo: AppliedPromoView | null; discountKes: number }> {
    const code = this.appliedPromos.get(cartId);
    if (!code) return { promo: null, discountKes: 0 };

    const { data, error } = await this.supabase.client
      .from('promo_codes')
      .select(
        'id, code, discount_type, value, category_id, max_uses, uses, starts_at, expires_at, is_active',
      )
      .eq('code', code)
      .maybeSingle();
    if (error || !data) {
      this.appliedPromos.delete(cartId);
      return { promo: null, discountKes: 0 };
    }

    const promo = data as PromoCodeRow;
    const now = Date.now();
    const stillValid =
      promo.is_active &&
      !(promo.starts_at && new Date(promo.starts_at).getTime() > now) &&
      !(promo.expires_at && new Date(promo.expires_at).getTime() < now) &&
      !(promo.max_uses !== null && promo.uses >= promo.max_uses);

    if (!stillValid) {
      this.appliedPromos.delete(cartId);
      return { promo: null, discountKes: 0 };
    }

    const discountKes = this.computeDiscountKes(
      promo.discount_type,
      Number(promo.value),
      subtotalKes,
    );

    return {
      promo: {
        code: promo.code,
        discountType: promo.discount_type,
        value: Number(promo.value),
        discountKes,
      },
      discountKes,
    };
  }

  /**
   * Compute the KES discount for a subtotal. Percentage discounts are
   * `subtotal * value / 100`; fixed discounts are the flat `value`. Both are
   * clamped to `[0, subtotal]` so the total never goes negative, then rounded
   * to 2 decimals (mirrors the promotions module).
   */
  private computeDiscountKes(
    discountType: 'percent' | 'fixed',
    value: number,
    subtotalKes: number,
  ): number {
    const raw =
      discountType === 'percent' ? (subtotalKes * value) / 100 : value;
    const clamped = Math.min(Math.max(raw, 0), subtotalKes);
    return round2(clamped);
  }
}
