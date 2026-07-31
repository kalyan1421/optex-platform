import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';

/** Input for a transactional email dispatch. */
export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
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

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Sends an email. At least one of `html` / `text` should be provided.
   *
   * @param input Recipient(s), subject, and body content.
   * @returns `{ ok: true }` when Resend accepts the request.
   */
  async sendEmail(input: SendEmailInput): Promise<EmailResult> {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    const from = this.config.get('RESEND_FROM', { infer: true }) ?? EmailService.DEFAULT_FROM;

    if (!apiKey) {
      this.logger.warn('Resend API key missing (RESEND_API_KEY); skipping email send');
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
        return { ok: false };
      }

      this.logger.log(
        `Email dispatched to ${Array.isArray(input.to) ? input.to.join(', ') : input.to}`,
      );
      return { ok: true };
    } catch (error) {
      this.logger.error(`Resend email send threw: ${(error as Error).message}`);
      return { ok: false };
    }
  }
}
