import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export type NotificationChannel = 'sms' | 'email';

/** A queued notification, as handed back to the retry sweep. */
export interface PendingNotification {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  subject: string | null;
  body: string;
  attempts: number;
}

/**
 * Retry schedule in minutes, indexed by attempt number.
 *
 * Front-loaded because the overwhelming majority of failures are transient —
 * a 502 from the provider, a DNS blip — and clear within a minute or two.
 * The tail stretches to roughly two hours so a longer provider outage is still
 * ridden out rather than abandoned. After the last entry the row goes to
 * `abandoned` and stops consuming sweep capacity, staying in the table as the
 * operational record that something was never delivered.
 */
const BACKOFF_MINUTES = [1, 5, 15, 60, 120];

/** Attempts after which a row is abandoned rather than retried again. */
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length;

/**
 * Durable record of every notification the platform tries to send (F-06).
 *
 * Before this, `SmsService` and `EmailService` caught their own errors, logged
 * to stdout and returned `{ ok: false }`. Nothing retried, nothing recorded the
 * attempt, and nothing could answer "was the customer actually told?" after the
 * fact. Since SMS is the primary customer channel in this market, an outage
 * silently lost order confirmations and appointment reminders until someone
 * phoned in to complain.
 *
 * Every send now writes a row here first, so a failure is a retryable, auditable
 * fact rather than a line in a log nobody is reading.
 */
@Injectable()
export class NotificationLogService {
  private readonly logger = new Logger(NotificationLogService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.client;
  }

  /**
   * Records an intent to send, returning the row id the send should report
   * against — or `null` if an identical message is already queued.
   *
   * `dedupeKey` is what makes a caller safe to invoke twice. Checkout, for
   * instance, fires its confirmation without awaiting; a retry of the enclosing
   * request would otherwise queue a second copy.
   */
  async record(input: {
    channel: NotificationChannel;
    recipient: string;
    body: string;
    subject?: string | null;
    dedupeKey?: string | null;
  }): Promise<string | null> {
    const { data, error } = await this.db
      .from('notification_log')
      .insert({
        channel: input.channel,
        recipient: input.recipient,
        subject: input.subject ?? null,
        body: input.body,
        dedupe_key: input.dedupeKey ?? null,
        status: 'pending',
        next_retry_at: new Date().toISOString(),
      })
      .select('id')
      .single<{ id: string }>();

    if (error) {
      // 23505 is the partial unique index on `dedupe_key` — an identical
      // message is already queued or in flight. Not an error condition.
      if (error.code === '23505') {
        return null;
      }
      // A logging failure must never take down the thing being logged about:
      // the send still proceeds, it just will not be retryable.
      this.logger.error(`Could not record notification intent: ${error.message}`);
      return null;
    }

    return data?.id ?? null;
  }

  /** Marks a queued notification delivered. */
  async markSent(id: string | null): Promise<void> {
    if (!id) return;
    const { error } = await this.db
      .from('notification_log')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      this.logger.error(`Could not mark notification ${id} sent: ${error.message}`);
    }
  }

  /**
   * Records a failed attempt and schedules the next one, or abandons the row
   * once the backoff schedule is exhausted.
   */
  async markFailed(id: string | null, reason: string): Promise<void> {
    if (!id) return;

    const { data } = await this.db
      .from('notification_log')
      .select('attempts')
      .eq('id', id)
      .maybeSingle<{ attempts: number }>();

    const attempts = (data?.attempts ?? 0) + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;
    const delayMinutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)];

    const { error } = await this.db
      .from('notification_log')
      .update({
        status: exhausted ? 'abandoned' : 'failed',
        attempts,
        // Truncated: provider errors can return an entire HTML error page, and
        // this column is read by humans scanning for a pattern.
        last_error: reason.slice(0, 500),
        next_retry_at: exhausted
          ? null
          : new Date(Date.now() + delayMinutes * 60_000).toISOString(),
      })
      .eq('id', id);

    if (error) {
      this.logger.error(`Could not mark notification ${id} failed: ${error.message}`);
    }

    if (exhausted) {
      this.logger.error(
        `Notification ${id} abandoned after ${attempts} attempts — last error: ${reason}`,
      );
    }
  }

  /** Notifications whose backoff has elapsed, oldest first. */
  async claimDue(limit = 50): Promise<PendingNotification[]> {
    const { data, error } = await this.db
      .from('notification_log')
      .select('id, channel, recipient, subject, body, attempts')
      .in('status', ['pending', 'failed'])
      .lte('next_retry_at', new Date().toISOString())
      .order('next_retry_at', { ascending: true })
      .limit(limit);

    if (error) {
      this.logger.error(`Could not load due notifications: ${error.message}`);
      return [];
    }

    return (data ?? []) as PendingNotification[];
  }
}
