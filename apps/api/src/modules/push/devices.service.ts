import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { DeviceTokensRepository } from './device-tokens.repository';
import type { DeregisterDeviceDto, RegisterDeviceDto } from './dto/device.dto';

/**
 * The customer-facing side of push (SPEC-11 B-1): a handset saying "send me
 * notifications" and "stop".
 *
 * Ownership comes from the JWT, never from the request: the token in the body is
 * the DEVICE, and which customer it belongs to is whoever is signed in when it is
 * registered.
 */
@Injectable()
export class DevicesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly tokens: DeviceTokensRepository,
  ) {}

  /**
   * Registers this handset for the caller, or refreshes an existing registration.
   * Idempotent — the app calls it on every start-up, on token rotation, and
   * whenever the mute set changes.
   */
  async register(authUserId: string, dto: RegisterDeviceDto): Promise<void> {
    const customerId = await this.resolveCustomerId(authUserId);
    await this.tokens.register({
      customerId,
      token: dto.token,
      platform: dto.platform,
      appVersion: dto.appVersion ?? null,
      mutedCategories: dto.mutedCategories ?? [],
    });
  }

  /**
   * Stops sending to a device. Always succeeds for an unknown token or one that
   * belongs to someone else — which of those it was is not the caller's to learn.
   */
  async deregister(authUserId: string, dto: DeregisterDeviceDto): Promise<void> {
    const customerId = await this.resolveCustomerId(authUserId);
    await this.tokens.deregister(customerId, dto.token);
  }

  private async resolveCustomerId(authUserId: string): Promise<string> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (error) throw new Error(`customer lookup failed: ${error.message}`);
    if (!data) throw new NotFoundException('No customer profile for the current user');
    return (data as { id: string }).id;
  }
}
