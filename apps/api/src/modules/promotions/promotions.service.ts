import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CreatePromoBannerDto } from './dto/create-promo-banner.dto';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { PromoValidationResultDto } from './dto/promo-validation-result.dto';
import { UpdatePromoBannerDto } from './dto/update-promo-banner.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { ValidatePromoDto } from './dto/validate-promo.dto';

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

/**
 * Business logic for promo-code validation and admin management of promo codes
 * and promo banners. All reads/writes go through the privileged service-role
 * client (`this.supabase.client`), which bypasses RLS.
 */
@Injectable()
export class PromotionsService {
  constructor(private readonly supabase: SupabaseService) {}

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
  async createCode(dto: CreatePromoCodeDto): Promise<PromoCodeRow> {
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
    return data as PromoCodeRow;
  }

  /** Patch a promo code by id. Re-uppercases `code` when present. */
  async updateCode(id: string, dto: UpdatePromoCodeDto): Promise<PromoCodeRow> {
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
    return data as PromoCodeRow;
  }

  /** Delete a promo code by id. */
  async deleteCode(id: string): Promise<{ id: string; deleted: true }> {
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
    return (data ?? []) as PromoBannerRow[];
  }

  /** Create a promo banner. */
  async createBanner(dto: CreatePromoBannerDto): Promise<PromoBannerRow> {
    const { data, error } = await this.supabase.client
      .from('promo_banners')
      .insert({ ...dto })
      .select('*')
      .single();
    if (error) {
      throw new InternalServerErrorException('Failed to create promo banner');
    }
    return data as PromoBannerRow;
  }

  /** Patch a promo banner by id. */
  async updateBanner(id: string, dto: UpdatePromoBannerDto): Promise<PromoBannerRow> {
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
    return data as PromoBannerRow;
  }

  /** Delete a promo banner by id. */
  async deleteBanner(id: string): Promise<{ id: string; deleted: true }> {
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
    return { id, deleted: true };
  }
}
