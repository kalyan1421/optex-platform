import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { NotificationLogService } from './notification-log.service';

/** Result of an SMS dispatch attempt. */
export interface SmsResult {
  ok: boolean;
}

/** Options controlling how a send is recorded for retry and audit. */
export interface SmsOptions {
  /**
   * Idempotency key, e.g. `order-confirmation:<orderId>`. Prevents a caller
   * that fires twice from queueing two copies of the same message.
   */
  dedupeKey?: string | null;
  /**
   * Set by the retry sweep, which already has a log row and must not create a
   * second one for the same message.
   */
  logId?: string | null;
}

/**
 * Sends transactional SMS via the Africa's Talking REST API.
 *
 * Credentials (`AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID`) are optional so the
 * foundation boots in dev before SMS is wired up. When any credential is
 * missing the service no-ops (logs a warning, returns `{ ok: false }`) instead
 * of throwing — keeping dev flows usable.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private static readonly ENDPOINT = 'https://api.africastalking.com/version1/messaging';

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly log: NotificationLogService,
  ) {}

  /**
   * Sends an SMS to a single recipient (E.164, e.g. `+2547XXXXXXXX`).
   *
   * F-06: every attempt is now recorded in `notification_log` BEFORE the
   * request goes out, and the outcome written back. A failure therefore leaves
   * a durable, retryable row rather than a line in a log nobody reads — which
   * is what makes a provider outage survivable instead of silently lossy.
   *
   * @returns `{ ok: true }` when Africa's Talking accepts the request.
   */
  async sendSms(to: string, message: string, opts: SmsOptions = {}): Promise<SmsResult> {
    const username = this.config.get('AT_USERNAME', { infer: true });
    const apiKey = this.config.get('AT_API_KEY', { infer: true });
    const from = this.config.get('AT_SENDER_ID', { infer: true });

    if (!username || !apiKey) {
      // Unconfigured is a deployment state, not a delivery failure: queueing
      // retries here would fill the table with rows that can never succeed.
      this.logger.warn(
        "Africa's Talking credentials missing (AT_USERNAME/AT_API_KEY); skipping SMS send",
      );
      return { ok: false };
    }

    // The sweep passes its own row id; first-time callers get one created.
    const logId =
      opts.logId ??
      (await this.log.record({
        channel: 'sms',
        recipient: to,
        body: message,
        dedupeKey: opts.dedupeKey,
      }));

    // `record` returns null when an identical message is already queued. Sending
    // anyway would defeat the dedupe key.
    if (!opts.logId && logId === null && opts.dedupeKey) {
      this.logger.debug(`SMS to ${to} already queued (${opts.dedupeKey}) — not sending again.`);
      return { ok: false };
    }

    const body = new URLSearchParams({ username, to, message });
    if (from) {
      body.set('from', from);
    }

    try {
      const response = await fetch(SmsService.ENDPOINT, {
        method: 'POST',
        headers: {
          apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        this.logger.error(`Africa's Talking SMS send failed (${response.status}): ${detail}`);
        await this.log.markFailed(logId, `HTTP ${response.status}: ${detail}`);
        return { ok: false };
      }

      this.logger.log(`SMS dispatched to ${to}`);
      await this.log.markSent(logId);
      return { ok: true };
    } catch (error) {
      this.logger.error(`Africa's Talking SMS send threw: ${(error as Error).message}`);
      await this.log.markFailed(logId, (error as Error).message);
      return { ok: false };
    }
  }
}
