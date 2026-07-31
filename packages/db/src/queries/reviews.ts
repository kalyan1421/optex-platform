import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

/**
 * Product review reads/writes (migrations 0001, 0006, 0009).
 *
 * Every `customerId` is a `customers.id`. Resolve a session with
 * `getCustomerIdForUser()` first — the RLS policies compare against
 * `current_customer_id()`, so an auth id silently matches nothing.
 */

export interface ReviewWithMeta {
  id: string;
  product_id: string;
  customer_id: string;
  rating: number;
  body: string | null;
  status: 'pending' | 'approved' | 'flagged';
  admin_reply: string | null;
  verified_purchase: boolean;
  created_at: string;
  updated_at: string | null;
  author_name: string | null;
  helpful_count: number;
  viewer_found_helpful: boolean;
  is_own: boolean;
}

interface RawReview {
  id: string;
  product_id: string;
  customer_id: string;
  rating: number;
  body: string | null;
  status: 'pending' | 'approved' | 'flagged';
  admin_reply: string | null;
  verified_purchase: boolean;
  created_at: string;
  updated_at: string | null;
  customer?: { full_name: string | null } | null;
}

/**
 * Approved reviews for a product, plus the caller's own review whatever its
 * moderation state — an author who has just submitted should still see their
 * pending review rather than wondering whether it saved.
 */
export async function listProductReviews(
  db: SupabaseClient<Database>,
  productId: string,
  viewerCustomerId?: string | null,
): Promise<ReviewWithMeta[]> {
  const columns =
    'id, product_id, customer_id, rating, body, status, admin_reply, verified_purchase, created_at, updated_at, customer:customers(full_name)';

  const approved = await db
    .from('product_reviews')
    .select(columns)
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (approved.error) throw approved.error;
  const rows = [...((approved.data ?? []) as unknown as RawReview[])];

  if (viewerCustomerId) {
    const own = await db
      .from('product_reviews')
      .select(columns)
      .eq('product_id', productId)
      .eq('customer_id', viewerCustomerId)
      .maybeSingle();

    if (own.error) throw own.error;
    const ownRow = own.data as unknown as RawReview | null;
    if (ownRow && !rows.some((r) => r.id === ownRow.id)) rows.unshift(ownRow);
  }

  if (rows.length === 0) return [];

  // Helpful-vote counts. review_helpful_votes is publicly readable, so this
  // works for signed-out visitors too.
  const ids = rows.map((r) => r.id);
  const votes = await db.from('review_helpful_votes').select('review_id, customer_id').in('review_id', ids);
  if (votes.error) throw votes.error;

  const counts = new Map<string, number>();
  const viewerVoted = new Set<string>();
  for (const vote of votes.data ?? []) {
    const v = vote as { review_id: string; customer_id: string };
    counts.set(v.review_id, (counts.get(v.review_id) ?? 0) + 1);
    if (viewerCustomerId && v.customer_id === viewerCustomerId) viewerVoted.add(v.review_id);
  }

  return rows.map((r) => ({
    id: r.id,
    product_id: r.product_id,
    customer_id: r.customer_id,
    rating: r.rating,
    body: r.body,
    status: r.status,
    admin_reply: r.admin_reply,
    verified_purchase: r.verified_purchase,
    created_at: r.created_at,
    updated_at: r.updated_at,
    author_name: r.customer?.full_name ?? null,
    helpful_count: counts.get(r.id) ?? 0,
    viewer_found_helpful: viewerVoted.has(r.id),
    is_own: viewerCustomerId ? r.customer_id === viewerCustomerId : false,
  }));
}

/** Average and count over approved reviews only — what the PDP badge shows. */
export async function getRatingSummary(
  db: SupabaseClient<Database>,
  productId: string,
): Promise<{ count: number; average: number | null }> {
  const { data, error } = await db
    .from('product_reviews')
    .select('rating')
    .eq('product_id', productId)
    .eq('status', 'approved');

  if (error) throw error;
  const ratings = (data ?? []).map((r) => (r as { rating: number }).rating);
  if (ratings.length === 0) return { count: 0, average: null };

  const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return { count: ratings.length, average: Math.round(average * 100) / 100 };
}

/**
 * Submit a review. `verified_purchase` is set by a database trigger from the
 * customer's order history — it is deliberately not accepted from the client.
 */
export async function submitReview(
  db: SupabaseClient<Database>,
  input: { productId: string; customerId: string; rating: number; body?: string | null },
): Promise<void> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error('Rating must be a whole number between 1 and 5.');
  }

  const { error } = await db.from('product_reviews').insert({
    product_id: input.productId,
    customer_id: input.customerId,
    rating: input.rating,
    body: input.body ?? null,
  });

  if (error) {
    // UNIQUE (product_id, customer_id) — one review per customer per product.
    if (error.code === '23505') throw new Error('You have already reviewed this product.');
    throw error;
  }
}

/**
 * Edit your own review. A content change sends it back to 'pending' via the
 * reset_review_status_on_edit trigger, so an approved review cannot be swapped
 * for different text after the fact.
 */
export async function updateOwnReview(
  db: SupabaseClient<Database>,
  reviewId: string,
  customerId: string,
  patch: { rating: number; body?: string | null },
): Promise<void> {
  if (!Number.isInteger(patch.rating) || patch.rating < 1 || patch.rating > 5) {
    throw new Error('Rating must be a whole number between 1 and 5.');
  }

  const { error } = await db
    .from('product_reviews')
    .update({ rating: patch.rating, body: patch.body ?? null })
    .eq('id', reviewId)
    .eq('customer_id', customerId);

  if (error) throw error;
}

export async function deleteOwnReview(
  db: SupabaseClient<Database>,
  reviewId: string,
  customerId: string,
): Promise<void> {
  const { error } = await db
    .from('product_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('customer_id', customerId);

  if (error) throw error;
}

/**
 * Toggle "this was helpful". Returns the new state so a button can be driven
 * from a single call. You cannot vote on your own review.
 */
export async function toggleHelpfulVote(
  db: SupabaseClient<Database>,
  reviewId: string,
  customerId: string,
): Promise<boolean> {
  const existing = await db
    .from('review_helpful_votes')
    .select('review_id')
    .eq('review_id', reviewId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data) {
    const { error } = await db
      .from('review_helpful_votes')
      .delete()
      .eq('review_id', reviewId)
      .eq('customer_id', customerId);
    if (error) throw error;
    return false;
  }

  const { error } = await db
    .from('review_helpful_votes')
    .insert({ review_id: reviewId, customer_id: customerId });
  if (error) throw error;
  return true;
}
