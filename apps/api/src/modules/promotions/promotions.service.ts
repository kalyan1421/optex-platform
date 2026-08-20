import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthUser } from '../../auth/auth-user';
import { CreatePromoBannerDto } from './dto/create-promo-banner.dto';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { PromoValidationResultDto } from './dto/promo-validation-result.dto';
import { UpdatePromoBannerDto } from './dto/update-promo-banner.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { ValidatePromoDto } from './dto/validate-promo.dto';
import { UploadedImage } from '../catalog/products.service';
import type { Env } from '../../config/env';

/** Shape of a `promo_codes` row (mirrors the Supabase schema). */
interface PromoCodeRow {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  value: number;
  category_id: string | null;
  max_uses: number | null;
  uses: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

/** Shape of a `promo_banners` row (mirrors the Supabase schema). */
interface PromoBannerRow {
  id: string;
  image_url: string;
  target_url: string | null;
  headline: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
}

const PROMO_BANNERS_BUCKET = 'promo-banners';
const MAX_BANNER_IMAGE_BYTES = 10 * 1024 * 1024;
const BANNER_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Business logic for promo-code validation and admin management of promo codes
 * and promo banners. All reads/writes go through the privileged service-role
 * client (`this.supabase.client`), which bypasses RLS.
 */
@Injectable()
export class PromotionsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Rewrite a Supabase storage public URL that uses the internal `SUPABASE_URL`
   * hostname (e.g. `http://supabase-kong:8000` inside Docker) to the
   * publicly accessible `SUPABASE_PUBLIC_URL` so browsers can actually fetch
   * uploaded files. No-op when `SUPABASE_PUBLIC_URL` is not configured.
   */
  private rewritePublicUrl(url: string): string {
    const publicBase = this.config.get('SUPABASE_PUBLIC_URL', { infer: true });
    const internalBase = this.config.get('SUPABASE_URL', { infer: true });
    if (publicBase && url.startsWith(internalBase)) {
      return publicBase.replace(/\/$/, '') + url.slice(internalBase.replace(/\/$/, '').length);
    }
    return url;
  }

  /**
   * The local Supabase Kong gateway requires the public anon key even for a
   * public storage object. An image tag/background cannot send request headers,
   * so include the public (non-secret) anon key in storage URLs returned to
   * browsers. Hosted Supabase accepts this query parameter too.
   */
  private makeStorageUrlBrowserReadable(url: string): string {
    const publicBase = this.config.get('SUPABASE_PUBLIC_URL', { infer: true });
    const anonKey = this.config.get('SUPABASE_ANON_KEY', { infer: true });
    if (!publicBase || !anonKey) return url;

    try {
      const parsed = new URL(url);
      const publicOrigin = new URL(publicBase).origin;
      if (
        parsed.origin === publicOrigin &&
        parsed.pathname.includes('/storage/v1/object/public/')
      ) {
        parsed.searchParams.set('apikey', anonKey);
        return parsed.toString();
      }
    } catch {
      // Leave manually-entered/non-URL image values unchanged.
    }
    return url;
  }

  /** Keep storage URLs browser-safe even for banners uploaded before this fix. */
  private toPublicBanner(row: PromoBannerRow): PromoBannerRow {
    return {
      ...row,
      image_url: this.makeStorageUrlBrowserReadable(this.rewritePublicUrl(row.image_url)),
    };
  }

  // ─── Customer-facing ────────────────────────────────────────────────────

  /**
   * Validate a promo code against the active flag, validity window, and usage
   * limit, and (when a subtotal is supplied) compute the discount in KES.
   *
   * Never throws on an invalid code — returns `{ valid: false, message }` so
   * the storefront can surface the reason without treating it as an error.
   */
  async validate(dto: ValidatePromoDto): Promise<PromoValidationResultDto> {
    const code = dto.code.trim().toUpperCase();

    const { data, error } = await this.supabase.client
      .from('promo_codes')
      .select(
        'id, code, discount_type, value, category_id, max_uses, uses, starts_at, expires_at, is_active, created_at',
      )
      .eq('code', code)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Failed to look up promo code');
    }

    if (!data) {
      return { valid: false, code, message: 'Promo code not found.' };
    }

    const promo = data as PromoCodeRow;
    const now = Date.now();

    if (!promo.is_active) {
      return this.invalid(promo, 'This promo code is no longer active.');
    }

    if (promo.starts_at && new Date(promo.starts_at).getTime() > now) {
      return this.invalid(promo, 'This promo code is not yet valid.');
    }

    if (promo.expires_at && new Date(promo.expires_at).getTime() < now) {
      return this.invalid(promo, 'This promo code has expired.');
    }

    if (promo.max_uses !== null && promo.uses >= promo.max_uses) {
      return this.invalid(promo, 'This promo code has reached its usage limit.');
    }

    const result: PromoValidationResultDto = {
      valid: true,
      code: promo.code,
      discountType: promo.discount_type,
      discountValue: Number(promo.value),
      message: 'Promo code applied.',
    };

    if (dto.subtotalKes !== undefined) {
      result.discountKes = this.computeDiscountKes(
        promo.discount_type,
        Number(promo.value),
        dto.subtotalKes,
      );
    }

    return result;
  }

  /**
   * Compute the KES discount for a subtotal. Percentage discounts are capped at
   * the subtotal so the order total never goes negative; fixed discounts are
   * likewise clamped to at most the subtotal. Result is rounded to 2 decimals.
   */
  private computeDiscountKes(
    discountType: 'percent' | 'fixed',
    value: number,
    subtotalKes: number,
  ): number {
    const raw = discountType === 'percent' ? (subtotalKes * value) / 100 : value;
    const clamped = Math.min(Math.max(raw, 0), subtotalKes);
    return Math.round(clamped * 100) / 100;
  }

  /** Build a failed-validation result that still echoes the code's details. */
  private invalid(promo: PromoCodeRow, message: string): PromoValidationResultDto {
    return {
      valid: false,
      code: promo.code,
      discountType: promo.discount_type,
      discountValue: Number(promo.value),
      message,
    };
  }

  // ─── Admin: promo codes ───────────────────────────────────────────────────

  /** List all promo codes, newest first. */
  async listCodes(): Promise<PromoCodeRow[]> {
    const { data, error } = await this.supabase.client
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false })
      // F-14: was unbounded. Promo codes are few today but nothing prunes
      // expired ones, so the list only ever grows.
      .limit(500);
    if (error) {
      throw new InternalServerErrorException('Failed to list promo codes');
    }
    return (data ?? []) as PromoCodeRow[];
  }

  /** Create a promo code. Code is uppercased; duplicates are rejected (409-ish). */
  async createCode(dto: CreatePromoCodeDto, actorUser: AuthUser): Promise<PromoCodeRow> {
    const payload = { ...dto, code: dto.code.trim().toUpperCase() };
    const { data, error } = await this.supabase.client
      .from('promo_codes')
      .insert(payload)
      .select('*')
      .single();
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new BadRequestException('A promo code with that code already exists.');
      }
      throw new InternalServerErrorException('Failed to create promo code');
    }
    const created = data as PromoCodeRow;
    await this.auditLog.record({
      actor: actorUser,
      action: 'promo_codes.create',
      resourceType: 'promo_codes',
      resourceId: created.id,
      after: created,
    });
    return created;
  }

  /** Patch a promo code by id. Re-uppercases `code` when present. */
  async updateCode(
    id: string,
    dto: UpdatePromoCodeDto,
    actorUser: AuthUser,
  ): Promise<PromoCodeRow> {
    const payload: Record<string, unknown> = { ...dto };
    if (typeof payload.code === 'string') {
      payload.code = payload.code.trim().toUpperCase();
    }
    const { data, error } = await this.supabase.client
      .from('promo_codes')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new BadRequestException('A promo code with that code already exists.');
      }
      throw new InternalServerErrorException('Failed to update promo code');
    }
    if (!data) {
      throw new NotFoundException(`Promo code ${id} not found`);
    }
    const updated = data as PromoCodeRow;
    await this.auditLog.record({
      actor: actorUser,
      action: 'promo_codes.update',
      resourceType: 'promo_codes',
      resourceId: id,
      after: updated,
    });
    return updated;
  }

  /** Delete a promo code by id. */
  async deleteCode(id: string, actorUser: AuthUser): Promise<{ id: string; deleted: true }> {
    const { data, error } = await this.supabase.client
      .from('promo_codes')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException('Failed to delete promo code');
    }
    if (!data) {
      throw new NotFoundException(`Promo code ${id} not found`);
    }
    await this.auditLog.record({
      actor: actorUser,
      action: 'promo_codes.delete',
      resourceType: 'promo_codes',
      resourceId: id,
    });
    return { id, deleted: true };
  }

  // ─── Admin: promo banners ─────────────────────────────────────────────────

  /** List all promo banners ordered by `sort_order` ascending. */
  async listBanners(): Promise<PromoBannerRow[]> {
    const { data, error } = await this.supabase.client
      .from('promo_banners')
      .select('*')
      .order('sort_order', { ascending: true })
      // F-14: was unbounded — same reasoning as listCodes.
      .limit(500);
    if (error) {
      throw new InternalServerErrorException('Failed to list promo banners');
    }
    return ((data ?? []) as PromoBannerRow[]).map((row) => this.toPublicBanner(row));
  }

  /**
   * List banners that are active right now — used by the public storefront
   * `GET /api/banners` endpoint. Filters on `is_active`, `starts_at`, and
   * `ends_at` so the carousel only shows what is live at this moment.
   */
  async listActiveBanners(): Promise<PromoBannerRow[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase.client
      .from('promo_banners')
      .select('*')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('sort_order', { ascending: true })
      .limit(20);
    if (error) {
      throw new InternalServerErrorException('Failed to fetch active banners');
    }
    return ((data ?? []) as PromoBannerRow[]).map((row) => this.toPublicBanner(row));
  }

  /** Upload a banner image to the promo-banners bucket and return its public URL. */
  async uploadBannerImage(file: UploadedImage): Promise<{ url: string }> {
    if (!file?.buffer?.length) throw new BadRequestException('No image file provided');
    if (file.size > MAX_BANNER_IMAGE_BYTES || file.buffer.length > MAX_BANNER_IMAGE_BYTES) {
      throw new BadRequestException('Banner image must be 10 MB or smaller');
    }

    const extension = BANNER_IMAGE_EXTENSIONS[file.mimetype?.toLowerCase()];
    if (!extension) {
      throw new BadRequestException('Banner image must be PNG, JPG, WebP, or GIF');
    }

    const objectPath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const { error: uploadError } = await this.supabase.client.storage
      .from(PROMO_BANNERS_BUCKET)
      .upload(objectPath, file.buffer, {
        upsert: false,
        contentType: file.mimetype,
      });

    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data } = this.supabase.client.storage
      .from(PROMO_BANNERS_BUCKET)
      .getPublicUrl(objectPath);

    return { url: this.makeStorageUrlBrowserReadable(this.rewritePublicUrl(data.publicUrl)) };
  }

  /** Create a promo banner. */
  async createBanner(dto: CreatePromoBannerDto, actorUser: AuthUser): Promise<PromoBannerRow> {
    const { data, error } = await this.supabase.client
      .from('promo_banners')
      .insert({ ...dto })
      .select('*')
      .single();
    if (error) {
      throw new InternalServerErrorException('Failed to create promo banner');
    }
    const created = data as PromoBannerRow;
    await this.auditLog.record({
      actor: actorUser,
      action: 'promo_banners.create',
      resourceType: 'promo_banners',
      resourceId: created.id,
      after: created,
    });
    return this.toPublicBanner(created);
  }

  /** Patch a promo banner by id. */
  async updateBanner(
    id: string,
    dto: UpdatePromoBannerDto,
    actorUser: AuthUser,
  ): Promise<PromoBannerRow> {
    const { data, error } = await this.supabase.client
      .from('promo_banners')
      .update({ ...dto })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException('Failed to update promo banner');
    }
    if (!data) {
      throw new NotFoundException(`Promo banner ${id} not found`);
    }
    const updated = data as PromoBannerRow;
    await this.auditLog.record({
      actor: actorUser,
      action: 'promo_banners.update',
      resourceType: 'promo_banners',
      resourceId: id,
      after: updated,
    });
    return this.toPublicBanner(updated);
  }

  /** Delete a promo banner by id. */
  async deleteBanner(id: string, actorUser: AuthUser): Promise<{ id: string; deleted: true }> {
    const { data, error } = await this.supabase.client
      .from('promo_banners')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException('Failed to delete promo banner');
    }
    if (!data) {
      throw new NotFoundException(`Promo banner ${id} not found`);
    }
    await this.auditLog.record({
      actor: actorUser,
      action: 'promo_banners.delete',
      resourceType: 'promo_banners',
      resourceId: id,
    });
    return { id, deleted: true };
  }
}
