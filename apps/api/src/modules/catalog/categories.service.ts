import { Injectable, NotFoundException } from '@nestjs/common';
import { toHttpException } from '../../common/supabase-error';
import { SupabaseService } from '../../supabase/supabase.service';

/** A single category row as returned by Supabase (`select('*')`). */
export type CategoryRow = Record<string, unknown> & {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
};

/**
 * Read access to product categories. Uses the service-role Supabase client.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly supabase: SupabaseService) {}

  /** List all categories ordered by their display `sort_order`. */
  async list(): Promise<CategoryRow[]> {
    const { data, error } = await this.supabase.client
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw toHttpException(error);
    return (data ?? []) as CategoryRow[];
  }

  /**
   * Single category by slug. Throws `NotFoundException` if it doesn't exist —
   * the category landing page's SSR metadata needs one category, not the
   * full list (SPEC-03 R7 / gap G-5).
   */
  async findBySlug(slug: string): Promise<CategoryRow> {
    const { data, error } = await this.supabase.client
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw toHttpException(error);
    if (!data) throw new NotFoundException(`Category "${slug}" not found`);
    return data as CategoryRow;
  }
}
