import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../database.types';

export type Product = Tables<'products'>;
export type Category = Tables<'categories'>;

export interface ListProductsOptions {
  categorySlug?: string;
  brand?: string;
  minPriceKes?: number;
  maxPriceKes?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Fetch active products with optional filtering. Designed to be called from
 * Server Components — pass either a server or service client.
 */
export async function listProducts(
  db: SupabaseClient<Database>,
  opts: ListProductsOptions = {},
): Promise<Product[]> {
  let query = db
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 24) - 1);

  if (opts.brand) query = query.eq('brand', opts.brand);
  if (opts.minPriceKes !== undefined) query = query.gte('price_kes', opts.minPriceKes);
  if (opts.maxPriceKes !== undefined) query = query.lte('price_kes', opts.maxPriceKes);

  if (opts.categorySlug) {
    const { data: cat } = await db
      .from('categories')
      .select('id')
      .eq('slug', opts.categorySlug)
      .maybeSingle();
    if (!cat) return [];
    query = query.eq('category_id', cat.id);
  }

  if (opts.search) {
    // H-1 FIX: Use raw to_tsquery (no `type` option) so that the :* prefix-match
    // syntax is honoured. `type: 'plain'` maps to plainto_tsquery which strips
    // the colon/asterisk, silently breaking prefix searches ("glasse" → no match).
    // With no type option PostgREST passes the expression directly to to_tsquery.
    const terms = opts.search
      .split(/\s+/)
      .map((t) => t.replace(/[^\p{L}\p{N}]+/gu, ''))
      .filter(Boolean);
    if (terms.length) {
      query = query.textSearch('search_tsv', terms.map((t) => `${t}:*`).join(' & '), {
        config: 'simple',
      });
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getProductBySlug(
  db: SupabaseClient<Database>,
  slug: string,
): Promise<Product | null> {
  const { data, error } = await db
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listCategories(db: SupabaseClient<Database>): Promise<Category[]> {
  const { data, error } = await db
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
