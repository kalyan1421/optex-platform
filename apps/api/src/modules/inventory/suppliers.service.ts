import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { CreateSupplierDto } from './dto/supplier.dto';
import type { UpdateSupplierDto } from './dto/supplier.dto';

export interface SupplierRow {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

const SUPPLIER_COLUMNS = 'id, name, contact_name, phone, email, address, is_active, created_at';

/**
 * Supplier master data (migration 0026). No hard delete: `goods_received_items`
 * references a supplier's GRNs `ON DELETE RESTRICT`, so a supplier with
 * receiving history can't be removed anyway — `is_active` (via
 * `UpdateSupplierDto`) is how a supplier is retired from the GRN picker
 * without breaking history, same posture as `customers`'s
 * `deactivated_at`/branches' pattern elsewhere in this codebase.
 */
@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAllForAdmin(activeOnly?: boolean): Promise<SupplierRow[]> {
    let query = this.supabase.client
      .from('suppliers')
      .select(SUPPLIER_COLUMNS)
      .order('name', { ascending: true });
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    if (error) {
      this.logger.error(`Failed to list suppliers: ${error.message}`);
      throw new InternalServerErrorException('Failed to list suppliers');
    }
    return (data ?? []) as SupplierRow[];
  }

  async findById(id: string): Promise<SupplierRow> {
    const { data, error } = await this.supabase.client
      .from('suppliers')
      .select(SUPPLIER_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      this.logger.error(`Failed to fetch supplier ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch supplier');
    }
    if (!data) throw new NotFoundException(`Supplier ${id} not found`);
    return data as SupplierRow;
  }

  async create(dto: CreateSupplierDto, actorUser: AuthUser): Promise<SupplierRow> {
    const { data, error } = await this.supabase.client
      .from('suppliers')
      .insert(dto)
      .select(SUPPLIER_COLUMNS)
      .single();
    if (error) {
      this.logger.error(`Failed to create supplier: ${error.message}`);
      throw new InternalServerErrorException('Failed to create supplier');
    }
    const created = data as SupplierRow;
    await this.auditLog.record({
      actor: actorUser,
      action: 'suppliers.create',
      resourceType: 'suppliers',
      resourceId: created.id,
      after: created,
    });
    return created;
  }

  async update(id: string, dto: UpdateSupplierDto, actorUser: AuthUser): Promise<SupplierRow> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No updatable fields provided');
    }
    const before = await this.findById(id);

    const { data, error } = await this.supabase.client
      .from('suppliers')
      .update(dto)
      .eq('id', id)
      .select(SUPPLIER_COLUMNS)
      .single();
    if (error) {
      this.logger.error(`Failed to update supplier ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to update supplier');
    }
    const after = data as SupplierRow;
    await this.auditLog.record({
      actor: actorUser,
      action: 'suppliers.update',
      resourceType: 'suppliers',
      resourceId: id,
      before,
      after,
    });
    return after;
  }
}
