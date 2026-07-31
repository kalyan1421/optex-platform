import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';

/** Result of an SMS dispatch attempt. */
export interface SmsResult {
  ok: boolean;
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

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Sends an SMS to a single recipient (E.164, e.g. `+2547XXXXXXXX`).
   *
   * @param to Destination phone number.
   * @param message Plain-text message body.
   * @returns `{ ok: true }` when Africa's Talking accepts the request.
   */
  async sendSms(to: string, message: string): Promise<SmsResult> {
    const username = this.config.get('AT_USERNAME', { infer: true });
    const apiKey = this.config.get('AT_API_KEY', { infer: true });
    const from = this.config.get('AT_SENDER_ID', { infer: true });

    if (!username || !apiKey) {
      this.logger.warn(
        "Africa's Talking credentials missing (AT_USERNAME/AT_API_KEY); skipping SMS send",
      );
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
        return { ok: false };
      }

      this.logger.log(`SMS dispatched to ${to}`);
      return { ok: true };
    } catch (error) {
      this.logger.error(`Africa's Talking SMS send threw: ${(error as Error).message}`);
      return { ok: false };
    }
  }
}
