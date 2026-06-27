import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json, Tables } from '../database.types'

export type Cart = Tables<'carts'>
export type CartItem = Tables<'cart_items'>

export interface CartItemWithProduct extends CartItem {
  product: Pick<
    Tables<'products'>,
    'id' | 'slug' | 'name' | 'brand' | 'images' | 'price_kes'
  >
}

export interface CartView {
  cartId: string
  items: CartItemWithProduct[]
  subtotalKes: number
  itemCount: number
}

/**
 * Look up the caller's cart (one per customer, enforced by the unique
 * constraint on `carts.customer_id`) and create it on first access.
 *
 * H-7 FIX: The original select-then-insert pattern has a race condition when
 * two browser tabs open simultaneously — both see no cart and both try to
 * INSERT, resulting in a unique-constraint crash. The fixed pattern upserts
 * (INSERT … ON CONFLICT DO NOTHING) and then always re-selects, so concurrent
 * callers safely converge on the same cart row.
 */
export async function getOrCreateCart(
  db: SupabaseClient<Database>,
  customerId: string,
): Promise<Cart> {
  // ignoreDuplicates: true → ON CONFLICT DO NOTHING (safe for concurrent tabs)
  await db
    .from('carts')
    .upsert({ customer_id: customerId }, { onConflict: 'customer_id', ignoreDuplicates: true })

  // Always re-select — works whether we just inserted or hit the conflict path.
  const { data: cart, error } = await db
    .from('carts')
    .select('*')
    .eq('customer_id', customerId)
    .single()
  if (error) throw error
  return cart
}

/**
 * Hydrate the cart with product details for rendering. Uses Supabase's
 * implicit foreign-key join syntax; cheaper than two round-trips.
 */
export async function getCartView(
  db: SupabaseClient<Database>,
  customerId: string,
): Promise<CartView | null> {
  const cart = await getOrCreateCart(db, customerId)
  const { data, error } = await db
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
    .eq('cart_id', cart.id)
    .order('id', { ascending: true })
  if (error) throw error

  // PostgREST returns the implicit-join column either as an object (single
  // row) or null if the FK row was deleted out from under us. We use
  // !inner above to make the JOIN required, but a stale view can still
  // surface nulls — drop those rows defensively rather than crashing the
  // cart page on render.
  const rawItems = (data ?? []) as Array<
    CartItem & { product: CartItemWithProduct['product'] | null }
  >
  const items: CartItemWithProduct[] = rawItems.filter(
    (i): i is CartItemWithProduct => i.product !== null,
  )
  const subtotalKes = items.reduce((s, i) => s + Number(i.product.price_kes) * i.quantity, 0)
  const itemCount = items.reduce((s, i) => s + i.quantity, 0)
  return { cartId: cart.id, items, subtotalKes, itemCount }
}

export interface AddCartItemInput {
  customerId: string
  productId: string
  quantity?: number
  lensOption?: Json | null
}

/**
 * Add (or increment) a product in the caller's cart. The cart_items table
 * has a unique constraint on (cart_id, product_id, lens_option) so we use
 * an upsert with an on-conflict update that increments the quantity.
 */
export async function addCartItem(
  db: SupabaseClient<Database>,
  input: AddCartItemInput,
): Promise<CartItem> {
  const cart = await getOrCreateCart(db, input.customerId)
  const qty = Math.max(1, input.quantity ?? 1)

  // Find an existing line that matches BOTH product_id AND lens_option. The
  // unique key is (cart_id, product_id, lens_option), so two adds with
  // different lens_option must produce two rows.
  //
  // We can't use a single .upsert because Postgres can't index jsonb equality
  // reliably for our schema. Instead we read-modify-write, and on the
  // off-chance two requests race and both try to INSERT, the unique
  // constraint catches one — we recover by re-selecting and incrementing.
  const lensOption = input.lensOption ?? null
  let select = db
    .from('cart_items')
    .select('*')
    .eq('cart_id', cart.id)
    .eq('product_id', input.productId)
  select = lensOption === null ? select.is('lens_option', null) : select.eq('lens_option', lensOption)
  const { data: existing, error: selectError } = await select.maybeSingle()
  if (selectError) throw selectError

  if (existing) {
    // H-6 FIX: Use the atomic DB function instead of a stale read-modify-write.
    // Without this, two concurrent "+1" requests both read quantity=N and both
    // write N+1, losing one increment. The SQL UPDATE quantity=quantity+delta
    // is serialised by Postgres and always produces N+2.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any).rpc('increment_cart_item_qty', {
      item_id: existing.id,
      delta: qty,
    })
    if (error) throw error
    return (Array.isArray(data) ? data[0] : data) as CartItem
  }

  const { data, error } = await db
    .from('cart_items')
    .insert({
      cart_id: cart.id,
      product_id: input.productId,
      quantity: qty,
      lens_option: lensOption,
    })
    .select()
    .single()
  if (error) {
    // 23505 = unique_violation. A concurrent request beat us to the insert;
    // use the atomic RPC to bump the winner's quantity rather than re-reading
    // a potentially stale value (H-6 fix applied to the race-recovery path too).
    if ((error as { code?: string }).code === '23505') {
      let raceSelect = db
        .from('cart_items')
        .select('id')
        .eq('cart_id', cart.id)
        .eq('product_id', input.productId)
      raceSelect =
        lensOption === null ? raceSelect.is('lens_option', null) : raceSelect.eq('lens_option', lensOption)
      const { data: winner, error: raceError } = await raceSelect.maybeSingle()
      if (raceError || !winner) throw raceError ?? error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: bumped, error: bumpError } = await (db as any).rpc('increment_cart_item_qty', {
        item_id: winner.id,
        delta: qty,
      })
      if (bumpError) throw bumpError
      return (Array.isArray(bumped) ? bumped[0] : bumped) as CartItem
    }
    throw error
  }
  return data
}

export async function updateCartItemQuantity(
  db: SupabaseClient<Database>,
  itemId: string,
  quantity: number,
): Promise<CartItem | null> {
  if (quantity <= 0) {
    await removeCartItem(db, itemId)
    return null
  }
  const { data, error } = await db
    .from('cart_items')
    .update({ quantity })
    .eq('id', itemId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeCartItem(
  db: SupabaseClient<Database>,
  itemId: string,
): Promise<void> {
  const { error } = await db.from('cart_items').delete().eq('id', itemId)
  if (error) throw error
}

/** Delete all items in a cart in a single round-trip. */
export async function clearCart(
  db: SupabaseClient<Database>,
  cartId: string,
): Promise<void> {
  const { error } = await db
    .from('cart_items')
    .delete()
    .eq('cart_id', cartId)
  if (error) throw error
}

/**
 * Read just the item count for the header cart badge. Stays under RLS
 * because cart_items is scoped to the caller's cart via the policy.
 */
export async function getCartItemCount(
  db: SupabaseClient<Database>,
  customerId: string,
): Promise<number> {
  const { data: cart } = await db
    .from('carts')
    .select('id')
    .eq('customer_id', customerId)
    .maybeSingle()
  if (!cart) return 0
  const { data, error } = await db
    .from('cart_items')
    .select('quantity')
    .eq('cart_id', cart.id)
  if (error) throw error
  return (data ?? []).reduce((s, r) => s + r.quantity, 0)
}
