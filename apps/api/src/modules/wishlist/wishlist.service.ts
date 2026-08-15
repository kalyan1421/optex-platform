import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

/** A saved product, with enough product data to render the wishlist page in one call. */
export interface WishlistItemView {
  productId: string;
  addedAt: string;
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string | null;
    priceKes: number;
    image: string | null;
    /**
     * `false` means discontinued/deactivated, not deleted — a hard-deleted
     * product cascades its wishlist row away (migration 0017), so this is
     * the only "unavailable" state the wishlist page ever has to render
     * (SPEC-10 R6's edge case), never a missing-product gap.
     */
    isActive: boolean;
  };
}

/**
 * Wishlist logic, mirroring `cart.service.ts`'s conventions (SPEC-10 R2).
 * The service-role client bypasses RLS, so ownership is resolved from the
 * caller's `auth_user_id` in code, same as every other customer-scoped
 * module here.
 */
@Injectable()
export class WishlistService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Lists the caller's saved products, most recently saved first. */
  async list(authUserId: string): Promise<WishlistItemView[]> {
    const customerId = await this.resolveCustomerId(authUserId);

    const { data, error } = await this.supabase.client
      .from('wishlist_items')
      .select(
        `
        product_id,
        created_at,
        product:products!inner ( id, slug, name, brand, images, price_kes, is_active )
        `,
      )
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);

    type RawJoin = {
      product_id: string;
      created_at: string;
      product: {
        id: string;
        slug: string;
        name: string;
        brand: string | null;
        images: string[] | null;
        price_kes: number;
        is_active: boolean;
      } | null;
    };

    return ((data ?? []) as unknown as RawJoin[])
      .filter((row): row is RawJoin & { product: NonNullable<RawJoin['product']> } => !!row.product)
      .map((row) => ({
        productId: row.product_id,
        addedAt: row.created_at,
        product: {
          id: row.product.id,
          slug: row.product.slug,
          name: row.product.name,
          brand: row.product.brand,
          priceKes: row.product.price_kes,
          image: row.product.images?.[0] ?? null,
          isActive: row.product.is_active,
        },
      }));
  }

  /**
   * Saves a product to the caller's wishlist. Idempotent: saving an
   * already-saved product (including the same-product-from-two-tabs race
   * SPEC-10's edge cases call out) is a no-op, not a conflict — the
   * composite primary key plus `ignoreDuplicates` is what guarantees that,
   * not an application-level check-then-insert.
   */
  async add(authUserId: string, productId: string): Promise<{ productId: string }> {
    const customerId = await this.resolveCustomerId(authUserId);

    const { data: product, error: productError } = await this.supabase.client
      .from('products')
      .select('id')
      .eq('id', productId)
      .maybeSingle();
    if (productError) throw new BadRequestException(productError.message);
    if (!product) {
      throw new NotFoundException(`Product "${productId}" not found`);
    }

    const { error } = await this.supabase.client
      .from('wishlist_items')
      .upsert(
        { customer_id: customerId, product_id: productId },
        { onConflict: 'customer_id,product_id', ignoreDuplicates: true },
      );
    if (error) throw new BadRequestException(error.message);

    return { productId };
  }

  /** Removes a product from the caller's wishlist. Idempotent: removing an already-absent product is a no-op. */
  async remove(authUserId: string, productId: string): Promise<{ productId: string }> {
    const customerId = await this.resolveCustomerId(authUserId);

    const { error } = await this.supabase.client
      .from('wishlist_items')
      .delete()
      .eq('customer_id', customerId)
      .eq('product_id', productId);
    if (error) throw new BadRequestException(error.message);

    return { productId };
  }

  /** Resolves the caller's `customers.id` from their `auth_user_id` (JWT subject). */
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
}
