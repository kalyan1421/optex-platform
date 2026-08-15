import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { SupabaseService } from '../../supabase/supabase.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

/** Postgres unique-violation code, raised by `customer_addresses_one_default_per_customer` (0016). */
const PG_UNIQUE_VIOLATION = '23505';

const ADDRESS_COLUMNS =
  'id, customer_id, label, name, phone, address, city, county, postal, is_default, created_at, updated_at';

/** A saved address row as returned by Supabase. */
export interface AddressRow {
  id: string;
  customer_id: string;
  label: string | null;
  name: string;
  phone: string;
  address: string;
  city: string;
  county: string;
  postal: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Saved addresses. The service-role client bypasses RLS, so every method
 * here explicitly scopes to the caller's own `customer_id` before touching a
 * row — RLS's "customer reads own addresses" policy is defense-in-depth, not
 * the enforcement boundary, matching the discipline `prescriptions.service.ts`
 * already applies for the same reason.
 */
@Injectable()
export class AddressesService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Lists the caller's own addresses, default first, then newest first. */
  async listMine(user: AuthUser): Promise<AddressRow[]> {
    const customerId = await this.resolveCustomerId(user);

    const { data, error } = await this.supabase.client
      .from('customer_addresses')
      .select(ADDRESS_COLUMNS)
      .eq('customer_id', customerId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException('Failed to load addresses');
    }
    return (data ?? []) as AddressRow[];
  }

  /** Creates a saved address for the caller. */
  async create(user: AuthUser, dto: CreateAddressDto): Promise<AddressRow> {
    const customerId = await this.resolveCustomerId(user);

    if (dto.isDefault) {
      await this.clearDefault(customerId);
    }

    const { data, error } = await this.supabase.client
      .from('customer_addresses')
      .insert({
        customer_id: customerId,
        label: dto.label ?? null,
        name: dto.name,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
        county: dto.county,
        postal: dto.postal ?? null,
        is_default: dto.isDefault ?? false,
      })
      .select(ADDRESS_COLUMNS)
      .single<AddressRow>();

    if (error || !data) {
      // A concurrent request setting a different address as default at the
      // exact same moment can lose this race to the unique index — same
      // "retry" signal `appointments.service.ts` gives on its own 23505.
      if (error?.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('Another update to your default address is in progress');
      }
      throw new InternalServerErrorException(error?.message ?? 'Failed to save address');
    }
    return data;
  }

  /** Updates one of the caller's own addresses. */
  async update(user: AuthUser, id: string, dto: UpdateAddressDto): Promise<AddressRow> {
    const customerId = await this.resolveCustomerId(user);
    await this.findOwned(id, customerId);

    if (dto.isDefault) {
      await this.clearDefault(customerId);
    }

    const patch: Record<string, unknown> = {};
    if (dto.label !== undefined) patch.label = dto.label;
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.address !== undefined) patch.address = dto.address;
    if (dto.city !== undefined) patch.city = dto.city;
    if (dto.county !== undefined) patch.county = dto.county;
    if (dto.postal !== undefined) patch.postal = dto.postal;
    if (dto.isDefault !== undefined) patch.is_default = dto.isDefault;

    const { data, error } = await this.supabase.client
      .from('customer_addresses')
      .update(patch)
      .eq('id', id)
      .select(ADDRESS_COLUMNS)
      .maybeSingle<AddressRow>();

    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('Another update to your default address is in progress');
      }
      throw new InternalServerErrorException('Failed to update address');
    }
    if (!data) {
      throw new NotFoundException('Address not found');
    }
    return data;
  }

  /** Deletes one of the caller's own addresses. Past orders keep their own snapshot regardless. */
  async remove(user: AuthUser, id: string): Promise<{ id: string }> {
    const customerId = await this.resolveCustomerId(user);
    await this.findOwned(id, customerId);

    const { error } = await this.supabase.client.from('customer_addresses').delete().eq('id', id);
    if (error) {
      throw new InternalServerErrorException('Failed to delete address');
    }
    return { id };
  }

  /** Marks one of the caller's own addresses as the default, clearing any prior default. */
  async setDefault(user: AuthUser, id: string): Promise<AddressRow> {
    const customerId = await this.resolveCustomerId(user);
    await this.findOwned(id, customerId);

    await this.clearDefault(customerId);

    const { data, error } = await this.supabase.client
      .from('customer_addresses')
      .update({ is_default: true })
      .eq('id', id)
      .select(ADDRESS_COLUMNS)
      .maybeSingle<AddressRow>();

    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('Another update to your default address is in progress');
      }
      throw new InternalServerErrorException('Failed to set default address');
    }
    if (!data) {
      throw new NotFoundException('Address not found');
    }
    return data;
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  /**
   * Unsets the caller's current default, if any. Not atomic with the write
   * that follows it — same advisory-check-then-write shape as
   * `appointments.service.ts`'s `assertSlotBookable`, with the partial
   * unique index (migration 0016) as the actual guarantee against two rows
   * ending up marked default.
   */
  private async clearDefault(customerId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', customerId)
      .eq('is_default', true);

    if (error) {
      throw new InternalServerErrorException('Failed to update default address');
    }
  }

  /**
   * Fetches an address and asserts the caller owns it. A row owned by a
   * different customer is reported as 404 (not 403) to avoid leaking
   * existence, matching every other customer-scoped module in this API.
   */
  private async findOwned(id: string, customerId: string): Promise<AddressRow> {
    const { data, error } = await this.supabase.client
      .from('customer_addresses')
      .select(ADDRESS_COLUMNS)
      .eq('id', id)
      .maybeSingle<AddressRow>();

    if (error) {
      throw new InternalServerErrorException('Failed to load address');
    }
    if (!data || data.customer_id !== customerId) {
      throw new NotFoundException('Address not found');
    }
    return data;
  }

  /**
   * Resolves the caller's `customers.id` from their `auth_user_id` (JWT
   * subject). Addresses reference `customers.id`, so this hop is required.
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
}
