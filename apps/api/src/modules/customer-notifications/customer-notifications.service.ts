import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { NotificationCategory, NotificationQueryDto } from './dto/notification-query.dto';

/** A `customer_notifications` row, as returned to the storefront. */
export interface NotificationView {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface PaginatedNotifications {
  data: NotificationView[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface NotificationRow {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Customer-facing notification feed: orders, appointments, and offers in
 * one inbox (migration 0035). Named `customer-notifications` — distinct
 * from the existing `notifications` module, which is SMS/email dispatch,
 * not a readable feed.
 *
 * `notify()`/`notifyAllCustomers()` are called from other modules
 * (orders, appointments, promotions, cron) at the same points those
 * modules already send an SMS/email. Never throws — a failed feed write
 * must not roll back or fail a mutation that already succeeded, the same
 * "observability failure isn't a business failure" posture as
 * `AuditLogService.record()` and the SMS/email senders.
 */
@Injectable()
export class CustomerNotificationsService {
  private readonly logger = new Logger(CustomerNotificationsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async notify(
    customerId: string,
    category: NotificationCategory,
    title: string,
    body: string,
    link?: string,
  ): Promise<void> {
    const { error } = await this.supabase.client.from('customer_notifications').insert({
      customer_id: customerId,
      category,
      title,
      body,
      link: link ?? null,
    });
    if (error) {
      this.logger.error(
        `Failed to write notification (${category} for ${customerId}): ${error.message}`,
      );
    }
  }

  /** Fans out one notification to every non-deactivated customer (e.g. a new offer). */
  async notifyAllCustomers(
    category: NotificationCategory,
    title: string,
    body: string,
    link?: string,
  ): Promise<void> {
    const { error } = await this.supabase.client.rpc('notify_all_customers', {
      p_category: category,
      p_title: title,
      p_body: body,
      p_link: link ?? null,
    });
    if (error) {
      this.logger.error(`Failed to fan out '${category}' notification: ${error.message}`);
    }
  }

  async listForCustomer(
    authUserId: string,
    query: NotificationQueryDto,
  ): Promise<PaginatedNotifications> {
    const customerId = await this.resolveCustomerId(authUserId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let builder = this.supabase.client
      .from('customer_notifications')
      .select('id, category, title, body, link, read_at, created_at', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.category) builder = builder.eq('category', query.category);
    if (query.unreadOnly) builder = builder.is('read_at', null);

    const { data, error, count } = await builder;
    if (error) throw new BadRequestException(error.message);

    const total = count ?? 0;
    return {
      data: ((data ?? []) as NotificationRow[]).map(toView),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async unreadCount(authUserId: string): Promise<{ count: number }> {
    const customerId = await this.resolveCustomerId(authUserId);
    const { count, error } = await this.supabase.client
      .from('customer_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .is('read_at', null);
    if (error) throw new BadRequestException(error.message);
    return { count: count ?? 0 };
  }

  /** Marks one of the caller's own notifications read. Idempotent. */
  async markRead(authUserId: string, id: string): Promise<NotificationView> {
    const customerId = await this.resolveCustomerId(authUserId);

    const { data, error } = await this.supabase.client
      .from('customer_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('customer_id', customerId)
      .select('id, category, title, body, link, read_at, created_at')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Notification not found');

    return toView(data as NotificationRow);
  }

  /** Marks every unread notification of the caller's own read. Returns how many changed. */
  async markAllRead(authUserId: string): Promise<{ count: number }> {
    const customerId = await this.resolveCustomerId(authUserId);

    const { data, error } = await this.supabase.client
      .from('customer_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('customer_id', customerId)
      .is('read_at', null)
      .select('id');
    if (error) throw new BadRequestException(error.message);

    return { count: (data ?? []).length };
  }

  /** Resolves the caller's `customers.id` from their `auth_user_id` (JWT subject). */
  private async resolveCustomerId(authUserId: string): Promise<string> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) {
      throw new NotFoundException('No customer profile for the current user');
    }
    return (data as { id: string }).id;
  }
}

function toView(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}
