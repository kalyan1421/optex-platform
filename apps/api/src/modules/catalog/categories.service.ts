import { BadRequestException, Injectable } from '@nestjs/common';
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

    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as CategoryRow[];
  }
}
