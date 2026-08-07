import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { SupabaseService } from '../../supabase/supabase.service';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';
import { UploadPrescriptionDto } from './dto/upload-prescription.dto';
import type { PrescriptionStatus } from './dto/update-prescription-status.dto';

/**
 * PRIVATE storage bucket for prescription scans (see migration 0003). Objects
 * are namespaced `<customer_id>/<filename>` and only ever exposed via
 * short-lived signed URLs.
 */
const PRESCRIPTIONS_BUCKET = 'prescriptions';

/** Seconds a download signed URL stays valid. */
const SIGNED_URL_TTL = 60;

/** Allowed upload MIME types (scan or photo of a paper prescription). */
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);

/** Max upload size: 10 MB — a sane ceiling for a scan/photo. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Columns selected for a prescription row returned to clients. */
const PRESCRIPTION_COLUMNS =
  'id, customer_id, order_id, file_url, sphere_od, sphere_os, cyl_od, cyl_os, axis_od, axis_os, pd, status, processed_at, created_at';

/**
 * Shape of an uploaded multipart file (subset of Express.Multer.File). Declared
 * locally so this module does not depend on global Multer types.
 */
export interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/** A prescription row as returned by Supabase. */
export interface PrescriptionRow {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  file_url: string | null;
  sphere_od: number | null;
  sphere_os: number | null;
  cyl_od: number | null;
  cyl_os: number | null;
  axis_od: number | null;
  axis_os: number | null;
  pd: number | null;
  status: string;
  processed_at: string | null;
  created_at: string;
}

/**
 * Prescriptions logic. HEALTH data — strict per-customer isolation enforced in
 * code (the service-role client bypasses RLS). The storage object path stores
 * the bucket-relative key (`<customer_id>/<file>`); `file_url` holds that same
 * path so downloads can re-sign it on demand. Never store a long-lived URL.
 */
@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ── Customer-facing ───────────────────────────────────────────────────────

  /**
   * Uploads a prescription file to the private bucket under the caller's
   * `customers.id` folder and inserts a `prescriptions` row referencing it.
   */
  async upload(
    user: AuthUser,
    file: UploadedFileLike | undefined,
    dto: UploadPrescriptionDto,
  ): Promise<PrescriptionRow> {
    if (!file?.buffer) {
      throw new BadRequestException('No file provided');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Unsupported file type. Allowed: PDF, JPG, PNG');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('File too large (max 10 MB)');
    }

    const customerId = await this.resolveOrCreateCustomerId(user);

    const objectPath = `${customerId}/${Date.now()}-${this.sanitizeName(file.originalname)}`;

    const { error: uploadError } = await this.supabase.client.storage
      .from(PRESCRIPTIONS_BUCKET)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      throw new BadRequestException(uploadError.message);
    }

    const insert: Record<string, unknown> = {
      customer_id: customerId,
      file_url: objectPath,
      status: 'pending',
    };
    if (dto.order_id !== undefined) insert.order_id = dto.order_id;
    if (dto.sphere_od !== undefined) insert.sphere_od = dto.sphere_od;
    if (dto.sphere_os !== undefined) insert.sphere_os = dto.sphere_os;
    if (dto.cyl_od !== undefined) insert.cyl_od = dto.cyl_od;
    if (dto.cyl_os !== undefined) insert.cyl_os = dto.cyl_os;
    if (dto.axis_od !== undefined) insert.axis_od = dto.axis_od;
    if (dto.axis_os !== undefined) insert.axis_os = dto.axis_os;
    if (dto.pd !== undefined) insert.pd = dto.pd;

    const { data, error } = await this.supabase.client
      .from('prescriptions')
      .insert(insert)
      .select(PRESCRIPTION_COLUMNS)
      .single<PrescriptionRow>();

    if (error || !data) {
      // Best-effort cleanup so we never orphan a stored object without a row.
      await this.supabase.client.storage.from(PRESCRIPTIONS_BUCKET).remove([objectPath]);
      throw new BadRequestException(error?.message ?? 'Failed to save prescription');
    }

    return data;
  }

  /** Lists the caller's own prescriptions, newest first. */
  async listMine(user: AuthUser): Promise<PrescriptionRow[]> {
    const customerId = await this.resolveCustomerId(user);

    const { data, error } = await this.supabase.client
      .from('prescriptions')
      .select(PRESCRIPTION_COLUMNS)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException('Failed to load prescriptions');
    }
    return (data ?? []) as PrescriptionRow[];
  }

  /**
   * Short-lived signed download URL for the caller's OWN prescription.
   * 404s if the prescription does not exist OR is not theirs (no info leak).
   */
  async downloadMine(user: AuthUser, id: string): Promise<{ url: string; expiresIn: number }> {
    const customerId = await this.resolveCustomerId(user);
    const row = await this.fetchById(id);

    if (!row || row.customer_id !== customerId) {
      throw new NotFoundException('Prescription not found');
    }

    return this.signFor(row);
  }

  // ── Admin-facing (super_admin) ──────────────────────────────────────────────

  /** Lists all prescriptions, optionally filtered by `customerId`. */
  async listAll(query: PrescriptionQueryDto): Promise<PrescriptionRow[]> {
    let builder = this.supabase.client
      .from('prescriptions')
      .select(PRESCRIPTION_COLUMNS)
      .order('created_at', { ascending: false });

    if (query.customerId) {
      builder = builder.eq('customer_id', query.customerId);
    }

    const { data, error } = await builder;
    if (error) {
      throw new InternalServerErrorException('Failed to load prescriptions');
    }
    return (data ?? []) as PrescriptionRow[];
  }

  /** Short-lived signed download URL for any prescription (admin viewer). */
  async downloadAsAdmin(id: string): Promise<{ url: string; expiresIn: number }> {
    const row = await this.fetchById(id);
    if (!row) {
      throw new NotFoundException('Prescription not found');
    }
    return this.signFor(row);
  }

  /**
   * Sets a prescription's processing status (admin only).
   *
   * `processed_at` is derived here rather than accepted from the caller, so the
   * timestamp can never contradict the status: moving to `processed` stamps
   * it, moving back to `pending` clears it. Re-applying the same status is a
   * no-op that returns the current row rather than re-stamping the time.
   */
  async updateStatusAsAdmin(id: string, status: PrescriptionStatus): Promise<PrescriptionRow> {
    const existing = await this.fetchById(id);
    if (!existing) {
      throw new NotFoundException('Prescription not found');
    }
    if (existing.status === status) {
      return existing;
    }

    const { data, error } = await this.supabase.client
      .from('prescriptions')
      .update({
        status,
        processed_at: status === 'processed' ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select(PRESCRIPTION_COLUMNS)
      .maybeSingle<PrescriptionRow>();

    if (error) {
      this.logger.error(`Failed to update prescription ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to update prescription');
    }
    if (!data) {
      throw new NotFoundException('Prescription not found');
    }
    return data;
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  /** Creates a signed URL for a row's stored object path. */
  private async signFor(row: PrescriptionRow): Promise<{ url: string; expiresIn: number }> {
    if (!row.file_url) {
      throw new NotFoundException('Prescription has no file');
    }

    const { data, error } = await this.supabase.client.storage
      .from(PRESCRIPTIONS_BUCKET)
      .createSignedUrl(row.file_url, SIGNED_URL_TTL);

    if (error || !data?.signedUrl) {
      throw new InternalServerErrorException('Failed to generate download URL');
    }
    return { url: data.signedUrl, expiresIn: SIGNED_URL_TTL };
  }

  /** Fetches a single prescription row by id, or null if absent. */
  private async fetchById(id: string): Promise<PrescriptionRow | null> {
    const { data, error } = await this.supabase.client
      .from('prescriptions')
      .select(PRESCRIPTION_COLUMNS)
      .eq('id', id)
      .maybeSingle<PrescriptionRow>();

    if (error) {
      throw new InternalServerErrorException('Failed to load prescription');
    }
    return data ?? null;
  }

  /**
   * Resolves the caller's `customers.id` from their `auth_user_id` (JWT
   * subject). Throws 403 if no customer row exists — read paths require an
   * existing customer record.
   */
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
   * upload is never lost for an authenticated user without a profile row yet.
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

  /**
   * Sanitizes an uploaded filename to a safe, bucket-friendly slug while
   * preserving the extension. Prevents path traversal / odd characters in the
   * object key.
   */
  private sanitizeName(originalName: string): string {
    const fallback = 'prescription';
    const name = (originalName ?? '').trim();
    if (!name) return `${fallback}.bin`;

    const lastDot = name.lastIndexOf('.');
    const base = lastDot > 0 ? name.slice(0, lastDot) : name;
    const ext = lastDot > 0 ? name.slice(lastDot + 1) : '';

    const safeBase =
      base
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || fallback;
    const safeExt = ext
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 8);

    return safeExt ? `${safeBase}.${safeExt}` : safeBase;
  }
}
