import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { DispatchTransferDto, ReceiveTransferDto, TransferDto } from './dto/transfer.dto';

interface TransferHeaderRow {
  id: string;
  transfer_number: string;
  from_branch_id: string;
  to_branch_id: string;
  status: 'pending' | 'in_transit' | 'received' | 'cancelled';
  notes: string | null;
  dispatched_at: string | null;
  received_at: string | null;
}

type EmbeddedProduct = { name: string } | { name: string }[] | null;
const unwrapProduct = (embed: EmbeddedProduct) => (Array.isArray(embed) ? (embed[0] ?? null) : embed);

/**
 * Inter-branch transfers — R2 sub-phase 2b. Dispatch and receive are each a
 * single `SECURITY DEFINER` RPC (`dispatch_transfer` / `receive_transfer`,
 * migration 0027) — the actual `product_serials`/`stock_ledger`/`inventory`
 * writes happen there, atomically, with the same lock-ordering guarantee
 * every other R2 write path follows.
 */
@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  async dispatch(dto: DispatchTransferDto, actorUser: AuthUser): Promise<TransferDto> {
    const { data, error } = await this.db.rpc('dispatch_transfer', {
      p_from_branch_id: dto.from_branch_id,
      p_to_branch_id: dto.to_branch_id,
      p_serial_ids: dto.serial_ids,
      p_requested_by: actorUser.id,
      p_actor_role: actorUser.role ?? 'unknown',
      p_notes: dto.notes ?? null,
    });
    if (error) {
      this.logger.error(`Failed to dispatch transfer: ${error.message}`);
      if (error.message?.includes('serial_not_in_stock_at_origin')) {
        throw new BadRequestException('One or more serials are not currently in stock at the origin branch');
      }
      if (error.message?.includes('serial_count_mismatch')) {
        throw new BadRequestException('One or more serial ids could not be dispatched');
      }
      if (error.message?.includes('from_branch_and_to_branch_must_differ')) {
        throw new BadRequestException('from_branch_id and to_branch_id must differ');
      }
      throw new InternalServerErrorException('Failed to dispatch transfer');
    }

    const transferId = data as string;
    const dispatched = await this.findById(transferId);
    await this.auditLog.record({
      actor: actorUser,
      action: 'transfers.dispatch',
      resourceType: 'stock_transfers',
      resourceId: transferId,
      after: dispatched,
      metadata: { fromBranchId: dto.from_branch_id, toBranchId: dto.to_branch_id, serialCount: dto.serial_ids.length },
    });
    return dispatched;
  }

  async receive(id: string, dto: ReceiveTransferDto, actorUser: AuthUser): Promise<TransferDto> {
    const before = await this.findById(id);
    if (before.status !== 'in_transit') {
      throw new BadRequestException('This transfer has already been fully resolved');
    }

    const { error } = await this.db.rpc('receive_transfer', {
      p_transfer_id: id,
      p_received: dto.received ?? [],
      p_lost: dto.lost ?? [],
      p_actor_id: actorUser.id,
      p_actor_role: actorUser.role ?? 'unknown',
    });
    if (error) {
      this.logger.error(`Failed to receive transfer ${id}: ${error.message}`);
      if (error.message?.includes('transfer_not_found')) {
        throw new NotFoundException(`Transfer ${id} not found`);
      }
      if (error.message?.includes('transfer_receive_conflict')) {
        throw new BadRequestException('A serial cannot be both received and lost in the same receipt');
      }
      throw new InternalServerErrorException('Failed to receive transfer');
    }

    const after = await this.findById(id);
    await this.auditLog.record({
      actor: actorUser,
      action: 'transfers.receive',
      resourceType: 'stock_transfers',
      resourceId: id,
      before,
      after,
      metadata: {
        toBranchId: after.to_branch_id,
        receivedCount: dto.received?.length ?? 0,
        lostCount: dto.lost?.length ?? 0,
      },
    });
    return after;
  }

  async findAllForAdmin(filters: { status?: string; fromBranchId?: string; toBranchId?: string }): Promise<TransferDto[]> {
    let query = this.db
      .from('stock_transfers')
      .select('id, transfer_number, from_branch_id, to_branch_id, status, notes, dispatched_at, received_at')
      .order('dispatched_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.fromBranchId) query = query.eq('from_branch_id', filters.fromBranchId);
    if (filters.toBranchId) query = query.eq('to_branch_id', filters.toBranchId);

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Failed to list transfers: ${error.message}`);
      throw new InternalServerErrorException('Failed to list transfers');
    }
    const headers = (data ?? []) as TransferHeaderRow[];
    return Promise.all(headers.map((h) => this.attachItems(h)));
  }

  async findById(id: string): Promise<TransferDto> {
    const { data, error } = await this.db
      .from('stock_transfers')
      .select('id, transfer_number, from_branch_id, to_branch_id, status, notes, dispatched_at, received_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      this.logger.error(`Failed to fetch transfer ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch transfer');
    }
    if (!data) throw new NotFoundException(`Transfer ${id} not found`);
    return this.attachItems(data as TransferHeaderRow);
  }

  private async attachItems(header: TransferHeaderRow): Promise<TransferDto> {
    const { data, error } = await this.db
      .from('stock_transfer_items')
      .select('status, serial:product_serials(id, serial_number, product:products(name))')
      .eq('transfer_id', header.id);
    if (error) {
      this.logger.error(`Failed to load transfer ${header.id} items: ${error.message}`);
      throw new InternalServerErrorException('Failed to load transfer items');
    }

    type RawItem = {
      status: 'in_transit' | 'received' | 'lost';
      serial: { id: string; serial_number: string; product: EmbeddedProduct } | { id: string; serial_number: string; product: EmbeddedProduct }[] | null;
    };

    const items = ((data ?? []) as unknown as RawItem[])
      .map((row) => {
        const serial = Array.isArray(row.serial) ? (row.serial[0] ?? null) : row.serial;
        if (!serial) return null;
        const product = unwrapProduct(serial.product);
        return {
          serial_id: serial.id,
          serial_number: serial.serial_number,
          product_name: product?.name ?? null,
          status: row.status,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return { ...header, items };
  }
}
