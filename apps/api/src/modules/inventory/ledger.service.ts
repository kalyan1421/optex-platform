import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  AgingSerialDto,
  InventorySerialDto,
  SerialHistoryDto,
  SerialLedgerEntryDto,
} from './dto/ledger.dto';

/** `sku` is only needed by the serial picker, so it is optional here. */
type ProductRef = { name: string; sku?: string | null };

type SerialRow = {
  id: string;
  serial_number: string;
  product_id: string;
  status: string;
  current_branch_id: string | null;
  cost_price_kes: number | null;
  received_at: string;
  product: ProductRef | ProductRef[] | null;
};

const unwrap = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

/** Read-only serial trace and dead-stock/aging views for R2 sub-phase 2e. */
@Injectable()
export class LedgerService {
  constructor(private readonly supabase: SupabaseService) {}

  async serialHistory(id: string, user: AuthUser): Promise<SerialHistoryDto> {
    const { data: serialData, error: serialError } = await this.supabase.client
      .from('product_serials')
      .select('id, serial_number, product_id, status, current_branch_id, product:products(name)')
      .eq('id', id)
      .maybeSingle();
    if (serialError) throw new InternalServerErrorException('Failed to load serial history');
    if (!serialData) throw new NotFoundException('Serial not found');
    const serial = serialData as unknown as SerialRow;

    let movementsQuery = this.supabase.client
      .from('stock_ledger')
      .select(
        'id, serial_id, movement_type, from_branch_id, to_branch_id, reference_type, reference_id, actor_user_id, actor_role, created_at',
      )
      .eq('serial_id', id)
      .order('created_at', { ascending: true });
    if (user.branchId) {
      movementsQuery = movementsQuery.or(
        `from_branch_id.eq.${user.branchId},to_branch_id.eq.${user.branchId}`,
      );
    }
    const { data: movements, error: movementError } = await movementsQuery;
    if (movementError) throw new InternalServerErrorException('Failed to load serial history');
    if (user.branchId && (movements ?? []).length === 0)
      throw new NotFoundException('Serial not found');

    return {
      serial_id: serial.id,
      serial_number: serial.serial_number,
      product_id: serial.product_id,
      product_name: unwrap(serial.product)?.name ?? 'Unknown product',
      current_status: serial.status,
      current_branch_id: serial.current_branch_id,
      movements: (movements ?? []) as SerialLedgerEntryDto[],
    };
  }

  /**
   * In-stock serials, optionally narrowed to a branch and/or product.
   *
   * Branch-scoped like every other read here: a Branch Manager's JWT
   * `branchId` overrides whatever the client asked for, so the filter cannot
   * be used to enumerate another branch's stock. Capped because a branch can
   * hold tens of thousands of units and a picker only ever needs a page.
   */
  async listSerials(
    user: AuthUser,
    filters: { branchId?: string; productId?: string; search?: string; limit?: number } = {},
  ): Promise<InventorySerialDto[]> {
    const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
    // The caller's own branch always wins over a supplied branchId.
    const branchId = user.branchId ?? filters.branchId;

    let query = this.supabase.client
      .from('product_serials')
      .select(
        'id, serial_number, product_id, status, current_branch_id, cost_price_kes, received_at, product:products(name, sku)',
      )
      .eq('status', 'in_stock')
      // Oldest first, so a picker offers FIFO units by default.
      .order('received_at', { ascending: true })
      .limit(limit);
    if (branchId) query = query.eq('current_branch_id', branchId);
    if (filters.productId) query = query.eq('product_id', filters.productId);
    // Serial search has to run server-side: a busy branch holds tens of
    // thousands of units, so filtering only the returned page would hide the
    // very unit the user is looking for. `%` and `_` are escaped so a typed
    // wildcard matches literally rather than widening the search.
    const search = filters.search?.trim();
    if (search) {
      const escaped = search.replace(/[\\%_]/g, (c) => `\\${c}`);
      query = query.ilike('serial_number', `%${escaped}%`);
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException('Failed to load serials');

    return ((data ?? []) as unknown as SerialRow[]).map((serial) => ({
      serial_id: serial.id,
      serial_number: serial.serial_number,
      product_id: serial.product_id,
      product_name: unwrap(serial.product)?.name ?? 'Unknown product',
      product_sku: unwrap(serial.product)?.sku ?? null,
      branch_id: serial.current_branch_id,
      status: serial.status,
      received_at: serial.received_at,
      cost_price_kes: serial.cost_price_kes ?? null,
    }));
  }

  async aging(user: AuthUser, minimumDays = 0): Promise<AgingSerialDto[]> {
    let query = this.supabase.client
      .from('product_serials')
      .select(
        'id, serial_number, product_id, status, current_branch_id, cost_price_kes, received_at, product:products(name)',
      )
      .eq('status', 'in_stock')
      .order('received_at', { ascending: true });
    if (user.branchId) query = query.eq('current_branch_id', user.branchId);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException('Failed to load aging report');

    const now = Date.now();
    return ((data ?? []) as unknown as SerialRow[])
      .map((serial) => ({
        serial_id: serial.id,
        serial_number: serial.serial_number,
        product_id: serial.product_id,
        product_name: unwrap(serial.product)?.name ?? 'Unknown product',
        branch_id: serial.current_branch_id!,
        received_at: serial.received_at,
        days_on_shelf: Math.max(
          0,
          Math.floor((now - new Date(serial.received_at).getTime()) / 86_400_000),
        ),
        cost_price_kes: serial.cost_price_kes,
      }))
      .filter((serial) => serial.days_on_shelf >= minimumDays);
  }
}
