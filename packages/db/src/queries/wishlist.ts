import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

/**
 * Wishlist reads/writes (migration 0009).
 *
 * Every id here is a `customers.id`, never an `auth.users.id` — resolve the
 * session with `getCustomerIdForUser()` first. `wishlists.customer_id` has a
 * foreign key to `customers`, and the RLS policy compares against
 * `current_customer_id()`, so an auth id fails both.
 */

/** A wishlist row joined to the product needed to render a card. */
export interface WishlistEntry {
  id: string;
  product_id: string;
  created_at: string;
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string | null;
    price_kes: number;
    images: string[];
    is_active: boolean;
  };
}

const PRODUCT_COLUMNS = 'id, slug, name, brand, price_kes, images, is_active';

/**
 * The customer's wishlist, newest first.
 *
 * Products that have since been delisted are filtered out rather than rendered
 * as dead cards — `is_active` is selected so the caller can tell the difference
 * if it ever needs to.
 */
export async function listWishlist(
  db: SupabaseClient<Database>,
  customerId: string,
): Promise<WishlistEntry[]> {
  const { data, error } = await db
    .from('wishlists')
    .select(`id, product_id, created_at, product:products(${PRODUCT_COLUMNS})`)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as WishlistEntry[]).filter((row) => row.product?.is_active);
}

/** Just the product ids, for cheaply deciding which hearts render as filled. */
export async function listWishlistProductIds(
  db: SupabaseClient<Database>,
  customerId: string,
): Promise<string[]> {
  const { data, error } = await db
    .from('wishlists')
    .select('product_id')
    .eq('customer_id', customerId);

  if (error) throw error;
  return (data ?? []).map((r) => (r as { product_id: string }).product_id);
}

/**
 * Add to the wishlist. Idempotent: the (customer, product) pair is UNIQUE, so
 * a double-click upserts rather than raising a duplicate-key error.
 */
export async function addToWishlist(
  db: SupabaseClient<Database>,
  customerId: string,
  productId: string,
): Promise<void> {
  const { error } = await db
    .from('wishlists')
    .upsert(
      { customer_id: customerId, product_id: productId },
      { onConflict: 'customer_id,product_id', ignoreDuplicates: true },
    );

  if (error) throw error;
}

export async function removeFromWishlist(
  db: SupabaseClient<Database>,
  customerId: string,
  productId: string,
): Promise<void> {
  const { error } = await db
    .from('wishlists')
    .delete()
    .eq('customer_id', customerId)
    .eq('product_id', productId);

  if (error) throw error;
}

/**
 * Flip wishlist membership and report the resulting state, so a heart button
 * can be driven from one call instead of a read followed by a write.
 */
export async function toggleWishlist(
  db: SupabaseClient<Database>,
  customerId: string,
  productId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from('wishlists')
    .select('id')
    .eq('customer_id', customerId)
    .eq('product_id', productId)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    await removeFromWishlist(db, customerId, productId);
    return false;
  }
  await addToWishlist(db, customerId, productId);
  return true;
}
