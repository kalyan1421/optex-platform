import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  InventoryBranchDto,
  InventoryItemDto,
  InventoryReconciliationItemDto,
  InventoryReconciliationResponseDto,
  InventoryResponseDto,
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
 * INVENTORY domain logic (admin-facing) — the read side of the R2 ledger.
 *
 * Uses the service-role client, so RLS is bypassed; access is gated at the
 * controller by `@RequirePermission('inventory.read')`. `stock` is a
 * denormalized cache maintained by every ledger-writing path (GRN, transfer,
 * adjustment, count, checkout, cancellation) — see migration 0026. There is
 * no longer a write method here: every stock correction goes through a GRN,
 * transfer, adjustment, or count (`GrnService`, `TransfersService`,
 * `AdjustmentsService`, `StockCountsService`), each of which requires a
 * reason and writes to `stock_ledger`. The old `PATCH /admin/inventory`
 * (`setStock`) is removed for exactly that reason — it let stock change with
 * no reason and no ledger trail.
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
   * Compares the `inventory.stock` cache to the serial-backed projection.
   * Branch-scoped users can only reconcile their own branch; cross-branch
   * roles receive the full report. This is deliberately a database RPC so the
   * aggregate never needs to pull every serial into NestJS memory.
   */
  async reconciliation(user: AuthUser): Promise<InventoryReconciliationResponseDto> {
    const { data, error } = await this.supabase.client.rpc('inventory_reconciliation_report', {
      p_branch_id: user.branchId ?? null,
    });
    if (error) {
      throw new InternalServerErrorException('Failed to reconcile inventory');
    }

    const items = (data ?? []) as InventoryReconciliationItemDto[];
    return { items, reconciled: items.every((item) => item.difference === 0) };
  }
}
