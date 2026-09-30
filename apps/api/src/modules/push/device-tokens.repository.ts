import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { NotificationCategory } from '../customer-notifications/dto/notification-query.dto';

export type DevicePlatform = 'ios' | 'android';

/** One live device, as the broadcast path pages through them. */
export interface DeviceRef {
  id: string;
  token: string;
}

/**
 * All access to `device_tokens` (migration 0044, SPEC-11 B-1).
 *
 * Kept apart from `PushService` so the sending logic can be exercised against a
 * fake without a database, and so the two rules that make this table safe live
 * in one place:
 *
 *  - a token identifies a DEVICE, so registering one that already exists MOVES
 *    it to the caller (the shared-handset case); and
 *  - a device is only ever offered to a sender if its owner has not muted the
 *    category, and has not been deactivated.
 */
@Injectable()
export class DeviceTokensRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.client;
  }

  /**
   * Registers a device for a customer, or refreshes it.
   *
   * ONE statement: an upsert on the unique `token`. If the token is already
   * registered — to this customer or another — the row is rewritten to belong to
   * the caller, its mute set replaced, and `disabled_at` cleared, so a device FCM
   * had given up on comes back to life the moment the app registers it again.
   */
  async register(input: {
    customerId: string;
    token: string;
    platform: DevicePlatform;
    appVersion: string | null;
    mutedCategories: NotificationCategory[];
  }): Promise<void> {
    const { error } = await this.db.from('device_tokens').upsert(
      {
        customer_id: input.customerId,
        token: input.token,
        platform: input.platform,
        app_version: input.appVersion,
        muted_categories: input.mutedCategories,
        last_seen_at: new Date().toISOString(),
        disabled_at: null,
      },
      { onConflict: 'token' },
    );
    if (error) throw new Error(`device_tokens upsert failed: ${error.message}`);
  }

  /**
   * Removes the caller's own registration of a token. Another customer's row is
   * never touched: the filter is on both columns, so someone who learns a token
   * cannot deregister a device that is not theirs.
   */
  async deregister(customerId: string, token: string): Promise<void> {
    const { error } = await this.db
      .from('device_tokens')
      .delete()
      .eq('customer_id', customerId)
      .eq('token', token);
    if (error) throw new Error(`device_tokens delete failed: ${error.message}`);
  }

  /** The customer's live devices that have not muted `category`. */
  async activeTokens(customerId: string, category: NotificationCategory): Promise<string[]> {
    const { data, error } = await this.db
      .from('device_tokens')
      // `!inner` + the filter below drops devices of a deactivated customer.
      .select('token, customer:customers!inner(deactivated_at)')
      .eq('customer_id', customerId)
      .is('disabled_at', null)
      .is('customer.deactivated_at', null)
      .not('muted_categories', 'cs', `{${category}}`);
    if (error) throw new Error(`device_tokens read failed: ${error.message}`);
    return ((data ?? []) as Array<{ token: string }>).map((r) => r.token);
  }

  /**
   * One page of every live, unmuted device, keyset-paginated on `id` so a
   * broadcast walks the table once in a stable order even while tokens are being
   * added and disabled underneath it.
   */
  async activePage(
    category: NotificationCategory,
    afterId: string | null,
    limit: number,
  ): Promise<DeviceRef[]> {
    let query = this.db
      .from('device_tokens')
      .select('id, token, customer:customers!inner(deactivated_at)')
      .is('disabled_at', null)
      .is('customer.deactivated_at', null)
      .not('muted_categories', 'cs', `{${category}}`)
      .order('id', { ascending: true })
      .limit(limit);
    if (afterId) query = query.gt('id', afterId);

    const { data, error } = await query;
    if (error) throw new Error(`device_tokens page failed: ${error.message}`);
    return ((data ?? []) as DeviceRef[]).map((r) => ({ id: r.id, token: r.token }));
  }

  /**
   * Marks tokens FCM has reported dead. Kept, not deleted — see the migration.
   * Only ever called for a permanent, token-specific failure.
   */
  async disable(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    const { error } = await this.db
      .from('device_tokens')
      .update({ disabled_at: new Date().toISOString() })
      .in('token', tokens)
      .is('disabled_at', null);
    if (error) throw new Error(`device_tokens disable failed: ${error.message}`);
  }
}
