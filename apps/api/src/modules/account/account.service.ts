import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { AuthUser } from '../../auth/auth-user';
import type { MeProfileDto } from './dto/me-profile.dto';
import type { UpdateMeDto } from './dto/update-me.dto';

/** Columns selected from `customers` for the `me` endpoints. */
const PROFILE_COLUMNS = 'id, auth_user_id, full_name, email, phone, created_at';

/** Raw `customers` row shape we read back. */
interface CustomerRow {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
}

/**
 * Account ("me") domain logic. All access is scoped to the caller's own
 * `customers` row, which is linked to the auth user via `auth_user_id`
 * (see `0004_customers_trigger.sql`). The service-role client bypasses RLS,
 * so scoping is enforced here in code by always filtering on `user.id`.
 */
@Injectable()
export class AccountService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Returns the caller's profile. If the `customers` row hasn't been created
   * yet (trigger lag, or pre-trigger user), falls back to the token identity.
   */
  async getProfile(user: AuthUser): Promise<MeProfileDto> {
    const row = await this.findByAuthUserId(user.id);

    if (!row) {
      return {
        id: user.id,
        email: user.email ?? null,
        full_name: null,
        phone: null,
        has_profile: false,
      };
    }

    return this.toDto(user, row);
  }

  /**
   * Updates only the editable columns (`full_name`, `phone`) on the caller's
   * own `customers` row, scoped by `auth_user_id`. If no row exists yet, one is
   * created for the caller so the update is not silently lost.
   */
  async updateProfile(user: AuthUser, dto: UpdateMeDto): Promise<MeProfileDto> {
    const existing = await this.findByAuthUserId(user.id);

    // Strip undefined so we never overwrite columns the caller didn't send.
    const patch: { full_name?: string | null; phone?: string | null } = {};
    if (dto.full_name !== undefined) patch.full_name = dto.full_name;
    if (dto.phone !== undefined) patch.phone = dto.phone;

    if (!existing) {
      const { data, error } = await this.supabase.client
        .from('customers')
        .insert({
          auth_user_id: user.id,
          email: user.email ?? null,
          ...patch,
        })
        .select(PROFILE_COLUMNS)
        .single<CustomerRow>();

      if (error || !data) {
        throw new InternalServerErrorException('Failed to create profile');
      }
      return this.toDto(user, data);
    }

    const { data, error } = await this.supabase.client
      .from('customers')
      .update(patch)
      .eq('auth_user_id', user.id)
      .select(PROFILE_COLUMNS)
      .single<CustomerRow>();

    if (error || !data) {
      throw new InternalServerErrorException('Failed to update profile');
    }

    return this.toDto(user, data);
  }

  /** Fetches the caller's `customers` row by auth user id, or null if none. */
  private async findByAuthUserId(authUserId: string): Promise<CustomerRow | null> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .select(PROFILE_COLUMNS)
      .eq('auth_user_id', authUserId)
      .maybeSingle<CustomerRow>();

    if (error) {
      throw new InternalServerErrorException('Failed to load profile');
    }

    return data ?? null;
  }

  /** Maps a `customers` row to the public `MeProfileDto`. */
  private toDto(user: AuthUser, row: CustomerRow): MeProfileDto {
    return {
      // Prefer the stable auth identity for `id` so callers always key on the
      // same value the token carries, regardless of the customers PK.
      id: user.id,
      email: row.email ?? user.email ?? null,
      full_name: row.full_name,
      phone: row.phone,
      has_profile: true,
    };
  }
}
