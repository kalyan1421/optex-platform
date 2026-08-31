import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { NotificationLogService } from './notification-log.service';

/** Input for a transactional email dispatch. */
export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  /** Idempotency key, e.g. `order-confirmation:<orderId>` (see SmsOptions). */
  dedupeKey?: string | null;
  /** Set by the retry sweep, which already owns a log row for this message. */
  logId?: string | null;
}

/** Result of an email dispatch attempt. */
export interface EmailResult {
  ok: boolean;
}

/**
 * Sends transactional email via the Resend HTTP API.
 *
 * `RESEND_API_KEY` is optional so the foundation boots in dev before email is
 * wired up. When it is missing the service no-ops (logs a warning, returns
 * `{ ok: false }`) instead of throwing.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private static readonly ENDPOINT = 'https://api.resend.com/emails';
  private static readonly DEFAULT_FROM = 'Optex <noreply@optexopticians.com>';

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly log: NotificationLogService,
  ) {}

  /**
   * Sends an email. At least one of `html` / `text` should be provided.
   *
   * F-06: recorded in `notification_log` before dispatch and updated with the
   * outcome, so a Resend outage leaves retryable rows instead of losing order
   * confirmations silently. See `SmsService.sendSms` — same contract.
   *
   * @returns `{ ok: true }` when Resend accepts the request.
   */
  async sendEmail(input: SendEmailInput): Promise<EmailResult> {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    const from = this.config.get('RESEND_FROM', { infer: true }) ?? EmailService.DEFAULT_FROM;

    if (!apiKey) {
      // Unconfigured is a deployment state, not a delivery failure — don't
      // queue retries that can never succeed.
      this.logger.warn('Resend API key missing (RESEND_API_KEY); skipping email send');
      return { ok: false };
    }

    const recipient = Array.isArray(input.to) ? input.to.join(', ') : input.to;
    const logId =
      input.logId ??
      (await this.log.record({
        channel: 'email',
        recipient,
        subject: input.subject,
        body: input.text ?? input.html ?? '',
        dedupeKey: input.dedupeKey,
      }));

    if (!input.logId && logId === null && input.dedupeKey) {
      this.logger.debug(`Email to ${recipient} already queued (${input.dedupeKey}) — skipping.`);
      return { ok: false };
    }

    try {
      const response = await fetch(EmailService.ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        this.logger.error(`Resend email send failed (${response.status}): ${detail}`);
        await this.log.markFailed(logId, `HTTP ${response.status}: ${detail}`);
        return { ok: false };
      }

      // Audit C-03: the recipient address used to be logged here, putting a
      // customer's email into production logs on every send and inheriting the
      // aggregator's retention. `notification_log` (migration 0023) already
      // holds the durable record, so log the handle and resolve it there when
      // someone genuinely needs the address.
      this.logger.log(`Email dispatched (${input.dedupeKey ?? 'no dedupe key'})`);
      await this.log.markSent(logId);
      return { ok: true };
    } catch (error) {
      this.logger.error(`Resend email send threw: ${(error as Error).message}`);
      await this.log.markFailed(logId, (error as Error).message);
      return { ok: false };
    }
  }
}
