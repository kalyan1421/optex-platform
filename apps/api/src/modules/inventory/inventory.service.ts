import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
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
 * controller by `@RequirePermission('inventory.read'|'inventory.write')`.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Returns active branches plus every product/branch stock row. The admin grid
   * renders one column per branch, so both halves are fetched together to keep
   * the client from having to make two round-trips and join them itself.
   *
   * R1 1b (branch scoping): a branch-scoped caller (Branch Manager,
   * `user.branchId` set) gets both halves scoped to just that branch — one
   * column, their own stock. Inventory Manager and Super Admin are NOT
   * branch-scoped (`roles.is_branch_scoped = false`), so they keep today's
   * cross-branch view. There is no client-supplied branch filter to guard
   * against here — this endpoint never took one.
   */
  async listForAdmin(user: AuthUser): Promise<InventoryResponseDto> {
    let branchesQuery = this.supabase.client
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true });
    let inventoryQuery = this.supabase.client.from('inventory').select(INVENTORY_COLUMNS);

    if (user.branchId) {
      branchesQuery = branchesQuery.eq('id', user.branchId);
      inventoryQuery = inventoryQuery.eq('branch_id', user.branchId);
    }

    const [branchesRes, inventoryRes] = await Promise.all([branchesQuery, inventoryQuery]);

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
   *
   * R1 1b (branch scoping): `dto.branch_id` is entirely client-supplied — a
   * Branch Manager holding `inventory.write` could otherwise set stock at any
   * branch, not just their own. Checked here rather than at the controller so
   * the same guarantee holds regardless of caller.
   */
  async setStock(
    dto: UpdateStockDto,
    user: AuthUser,
  ): Promise<{ product_id: string; branch_id: string; stock: number }> {
    if (user.branchId && dto.branch_id !== user.branchId) {
      throw new ForbiddenException('Cannot set stock for a branch other than your own');
    }

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
