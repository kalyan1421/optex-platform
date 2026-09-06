import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateEyeRecordDto } from './dto/create-eye-record.dto';
import type { AdminEyeRecordDto, EyeRecordDto, EyeRecordStatus } from './dto/eye-record.dto';
import { EyeRecordQueryDto } from './dto/eye-record-query.dto';

export type EyeRecordRow = EyeRecordDto;
export type AdminEyeRecordRow = AdminEyeRecordDto;

/** Every column of `eye_records`. No secrets here — the whole row is the payload. */
const EYE_RECORD_COLUMNS = `
  id, customer_id, appointment_id, full_name, age, phone, email, gender,
  conditions, history_notes,
  sphere_od, sphere_os, cyl_od, cyl_os, axis_od, axis_os,
  add_od, add_os, pd_od, pd_os,
  status, reviewed_by, reviewed_at, created_at, branch_id
`;

/** Admin reads additionally resolve the branch name for the review queue. */
const ADMIN_EYE_RECORD_COLUMNS = `${EYE_RECORD_COLUMNS}, branch:branches(name)`;

/**
 * PostgREST returns a to-one embed as either an object or a single-element
 * array depending on how it infers the relationship — the same normalisation
 * `appointments.service.ts` applies to its own `branch`/`customer` embeds. A
 * second FK to `branches` would be enough to flip the inference and make the
 * admin screen render every row as "Unassigned", so normalise both shapes.
 */
type RawEmbed<T> = T | T[] | null;

function unwrapBranch(row: unknown): AdminEyeRecordRow {
  const r = row as Omit<AdminEyeRecordRow, 'branch'> & { branch: RawEmbed<{ name: string }> };
  return { ...r, branch: Array.isArray(r.branch) ? (r.branch[0] ?? null) : r.branch };
}

/**
 * Clinical intake records submitted from the storefront's /eye-care form
 * (migration 0037).
 *
 * Health data, so the customer-facing reads are scoped to the caller's own
 * `customers` row exactly like `PrescriptionsService`, and there is no
 * customer-facing update path at all: a submitted record is immutable from the
 * storefront. Only staff holding `eye_records.write` can move its status.
 */
@Injectable()
export class EyeRecordsService {
  private readonly logger = new Logger(EyeRecordsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Submit an intake record for the calling customer. */
  async create(user: AuthUser, dto: CreateEyeRecordDto): Promise<EyeRecordRow> {
    const customerId = await this.resolveOrCreateCustomerId(user);

    // An appointment id supplied by the client is only trusted after we
    // confirm it belongs to this customer — otherwise a caller could attach
    // their intake to somebody else's visit. The same lookup yields the branch
    // the record is scoped to (0038): derived here from the verified
    // appointment, never taken from the request body.
    let branchId: string | null = null;
    if (dto.appointmentId) {
      branchId = await this.assertOwnsAppointment(customerId, dto.appointmentId);
    }

    const insert = {
      customer_id: customerId,
      appointment_id: dto.appointmentId ?? null,
      branch_id: branchId,
      full_name: dto.fullName,
      age: dto.age ?? null,
      phone: dto.phone,
      email: dto.email ?? null,
      gender: dto.gender ?? null,
      conditions: dto.conditions ?? [],
      history_notes: dto.historyNotes ?? null,
      sphere_od: dto.sphereOd ?? null,
      sphere_os: dto.sphereOs ?? null,
      cyl_od: dto.cylOd ?? null,
      cyl_os: dto.cylOs ?? null,
      axis_od: dto.axisOd ?? null,
      axis_os: dto.axisOs ?? null,
      add_od: dto.addOd ?? null,
      add_os: dto.addOs ?? null,
      pd_od: dto.pdOd ?? null,
      pd_os: dto.pdOs ?? null,
    };

    const { data, error } = await this.supabase.client
      .from('eye_records')
      .insert(insert)
      .select(EYE_RECORD_COLUMNS)
      .single<EyeRecordRow>();

    if (error || !data) {
      this.logger.error(`Failed to create eye record: ${error?.message}`);
      throw new InternalServerErrorException('Failed to save eye record');
    }
    return data;
  }

  /** The caller's own records, newest first. */
  async listMine(user: AuthUser): Promise<EyeRecordRow[]> {
    const customerId = await this.resolveCustomerId(user);

    const { data, error } = await this.supabase.client
      .from('eye_records')
      .select(EYE_RECORD_COLUMNS)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .returns<EyeRecordRow[]>();

    if (error) {
      this.logger.error(`Failed to list eye records: ${error.message}`);
      throw new InternalServerErrorException('Failed to load eye records');
    }
    return data ?? [];
  }

  /**
   * Staff listing, optionally filtered by customer and/or status.
   *
   * Branch scoping (0038): a branch-scoped caller (`user.branchId` set) sees
   * only their own branch's intake. The filter comes from the caller's JWT,
   * never from the query string — a client-supplied branch id is ignored
   * entirely, matching inventory/appointments/orders.
   *
   * A record with a null `branch_id` (intake submitted with no appointment
   * behind it) is invisible to a scoped caller by construction: no branch owns
   * it, so no branch queue should claim it. An unscoped Super Admin still sees
   * every row, which is where those land.
   */
  async listAll(query: EyeRecordQueryDto, user: AuthUser): Promise<AdminEyeRecordRow[]> {
    let q = this.supabase.client
      .from('eye_records')
      .select(ADMIN_EYE_RECORD_COLUMNS)
      .order('created_at', { ascending: false });

    if (user.branchId) q = q.eq('branch_id', user.branchId);
    if (query.customerId) q = q.eq('customer_id', query.customerId);
    if (query.status) q = q.eq('status', query.status);

    const { data, error } = await q.returns<unknown[]>();
    if (error) {
      this.logger.error(`Failed to list eye records: ${error.message}`);
      throw new InternalServerErrorException('Failed to load eye records');
    }
    return (data ?? []).map(unwrapBranch);
  }

  /**
   * One record, for the staff detail view. Out-of-branch is a 404, not a 403 —
   * the response must not confirm that another branch's record exists.
   */
  async getAsAdmin(id: string, user: AuthUser): Promise<AdminEyeRecordRow> {
    const row = await this.fetchById(id, ADMIN_EYE_RECORD_COLUMNS);
    if (!row) throw new NotFoundException('Eye record not found');
    this.assertInBranch(row, user);
    return unwrapBranch(row);
  }

  /**
   * Move a record through its review lifecycle.
   *
   * `reviewed_at`/`reviewed_by` are stamped or cleared server-side to match the
   * status, so the three can never disagree — the same invariant
   * `PrescriptionsService.updateStatusAsAdmin` holds for `processed_at`.
   */
  async updateStatusAsAdmin(
    id: string,
    status: EyeRecordStatus,
    user: AuthUser,
  ): Promise<AdminEyeRecordRow> {
    const before = await this.fetchById(id);
    if (!before) throw new NotFoundException('Eye record not found');
    this.assertInBranch(before, user);

    const reviewed = status === 'reviewed';
    const { data, error } = await this.supabase.client
      .from('eye_records')
      .update({
        status,
        reviewed_at: reviewed ? new Date().toISOString() : null,
        reviewed_by: reviewed ? user.id : null,
      })
      .eq('id', id)
      .select(ADMIN_EYE_RECORD_COLUMNS)
      .single<EyeRecordRow>();

    if (error || !data) {
      this.logger.error(`Failed to update eye record ${id}: ${error?.message}`);
      throw new InternalServerErrorException('Failed to update eye record');
    }

    await this.auditLog.record({
      actor: user,
      action: 'eye_record.status_changed',
      resourceType: 'eye_record',
      resourceId: id,
      before: { status: before.status },
      after: { status: data.status },
    });

    return unwrapBranch(data);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /**
   * 404s a branch-scoped caller reaching outside their branch, including for a
   * record that belongs to no branch at all.
   */
  private assertInBranch(row: EyeRecordRow, user: AuthUser): void {
    if (user.branchId && row.branch_id !== user.branchId) {
      throw new NotFoundException('Eye record not found');
    }
  }

  private async fetchById(
    id: string,
    columns: string = EYE_RECORD_COLUMNS,
  ): Promise<EyeRecordRow | null> {
    const { data, error } = await this.supabase.client
      .from('eye_records')
      .select(columns)
      .eq('id', id)
      .maybeSingle<EyeRecordRow>();

    if (error) {
      throw new InternalServerErrorException('Failed to load eye record');
    }
    return data ?? null;
  }

  /**
   * Confirms the appointment exists and belongs to this customer before it is
   * linked. A 404 rather than a 403 for a foreign id: whether somebody else's
   * appointment exists is not the caller's business.
   */
  private async assertOwnsAppointment(
    customerId: string,
    appointmentId: string,
  ): Promise<string | null> {
    const { data, error } = await this.supabase.client
      .from('appointments')
      .select('id, branch_id')
      .eq('id', appointmentId)
      .eq('customer_id', customerId)
      .maybeSingle<{ id: string; branch_id: string | null }>();

    if (error) {
      throw new InternalServerErrorException('Failed to verify appointment');
    }
    if (!data) {
      throw new NotFoundException('Appointment not found');
    }
    return data.branch_id;
  }

  /** Resolves the caller's `customers.id`; 403 when they have no profile row. */
  private async resolveCustomerId(user: AuthUser): Promise<string> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new InternalServerErrorException('Failed to resolve customer');
    }
    if (!data) {
      throw new ForbiddenException('No customer profile for this account');
    }
    return data.id;
  }

  /**
   * Resolves the caller's `customers.id`, creating the row on first use so an
   * intake submission is never lost for an authenticated user who has not
   * transacted yet. Mirrors `PrescriptionsService.resolveOrCreateCustomerId`.
   */
  private async resolveOrCreateCustomerId(user: AuthUser): Promise<string> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new InternalServerErrorException('Failed to resolve customer');
    }
    if (data) return data.id;

    const { data: created, error: createError } = await this.supabase.client
      .from('customers')
      .insert({ auth_user_id: user.id, email: user.email ?? null })
      .select('id')
      .single<{ id: string }>();

    if (createError || !created) {
      throw new InternalServerErrorException('Failed to create customer');
    }
    return created.id;
  }
}
