import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  InventoryBranchDto,
  InventoryItemDto,
  InventoryResponseDto,
  UpdateStockDto,
} from './dto/inventory.dto';

/** Columns selected from `inventory`, with the product and its category joined. */
const INVENTORY_COLUMNS =
  'product_id, branch_id, stock, product:products(id, name, sku, category:categories(name))';

/** Shape Supabase returns for the embedded product join, before flattening. */
type RawInventoryRow = {
  product_id: string;
  branch_id: string;
  stock: number;
  product: {
    id: string;
    name: string;
    sku: string;
    category: { name: string } | { name: string }[] | null;
  } | null;
};

/**
 * INVENTORY domain logic (admin-facing).
 *
 * Uses the service-role client, so RLS is bypassed; access is gated at the
 * controller by `@Roles('super_admin')`.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Returns active branches plus every product/branch stock row. The admin grid
   * renders one column per branch, so both halves are fetched together to keep
   * the client from having to make two round-trips and join them itself.
   */
  async listForAdmin(): Promise<InventoryResponseDto> {
    const [branchesRes, inventoryRes] = await Promise.all([
      this.supabase.client
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      this.supabase.client.from('inventory').select(INVENTORY_COLUMNS),
    ]);

    if (branchesRes.error || inventoryRes.error) {
      throw new InternalServerErrorException('Failed to load inventory');
    }

    const branches = (branchesRes.data ?? []) as InventoryBranchDto[];

    // PostgREST returns an embedded to-one join as either an object or a
    // single-element array depending on how it infers the relationship, so
    // normalise both shapes before exposing a flat `category_name`.
    const items: InventoryItemDto[] = ((inventoryRes.data ?? []) as unknown as RawInventoryRow[])
      .filter((row) => row.product !== null)
      .map((row) => {
        const category = Array.isArray(row.product!.category)
          ? (row.product!.category[0] ?? null)
          : row.product!.category;

        return {
          product_id: row.product_id,
          branch_id: row.branch_id,
          stock: row.stock,
          product: {
            id: row.product!.id,
            name: row.product!.name,
            sku: row.product!.sku,
            category_name: category?.name ?? null,
          },
        };
      });

    return { branches, items };
  }

  /**
   * Sets the stock level for one product at one branch.
   *
   * Returns the updated row so the caller can reconcile optimistic UI state. A
   * missing (product_id, branch_id) pair is a 404 rather than a silent no-op —
   * the browser-direct version this replaced updated zero rows without any
   * indication that the write had not landed.
   */
  async setStock(
    dto: UpdateStockDto,
  ): Promise<{ product_id: string; branch_id: string; stock: number }> {
    const { data, error } = await this.supabase.client
      .from('inventory')
      .update({ stock: dto.stock })
      .eq('product_id', dto.product_id)
      .eq('branch_id', dto.branch_id)
      .select('product_id, branch_id, stock')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Failed to update stock');
    }

    if (!data) {
      throw new NotFoundException('No inventory row for that product and branch');
    }

    return data as { product_id: string; branch_id: string; stock: number };
  }
}
