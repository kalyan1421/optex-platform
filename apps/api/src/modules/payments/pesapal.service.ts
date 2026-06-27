import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { PESAPAL_BASE_URL, isProd } from './payments.constants';

/** Cached Pesapal bearer token + absolute expiry (epoch ms). */
interface CachedToken {
  token: string;
  expiresAt: number;
}

/** Billing/contact details Pesapal requires on SubmitOrderRequest. */
export interface PesapalBillingAddress {
  email_address?: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
}

/** Params to submit an order to Pesapal. */
export interface PesapalSubmitParams {
  /** Our merchant reference — the order number. Must be unique per attempt. */
  merchantReference: string;
  amount: number;
  description: string;
  billing: PesapalBillingAddress;
}

/** Parsed SubmitOrderRequest response. */
export interface PesapalSubmitResponse {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
  status: string;
}

/** Parsed GetTransactionStatus response (the trusted source of truth). */
export interface PesapalTransactionStatus {
  payment_method?: string;
  amount?: number;
  currency?: string;
  /** "COMPLETED" | "FAILED" | "REVERSED" | "INVALID" | "PENDING" */
  payment_status_description?: string;
  /** 0 INVALID, 1 COMPLETED, 2 FAILED, 3 REVERSED. */
  status_code?: number;
  confirmation_code?: string;
  merchant_reference?: string;
  message?: string;
}

/**
 * Pesapal v3 client.
 *
 * MISSING-CREDS CONTRACT: identical to `MpesaService` — the constructor is
 * inert; `requireCreds()` throws `ServiceUnavailableException('Pesapal not
 * configured')` at call time when keys are absent.
 *
 * IPN TRUST MODEL: the IPN payload is never trusted. The webhook/status flow
 * always calls `getTransactionStatus()` and resolves the real outcome from
 * Pesapal directly.
 */
@Injectable()
export class PesapalService {
  private readonly logger = new Logger(PesapalService.name);
  private tokenCache: CachedToken | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get('PESAPAL_CONSUMER_KEY', { infer: true }) &&
        this.config.get('PESAPAL_CONSUMER_SECRET', { infer: true }),
    );
  }

  private requireCreds(): { consumerKey: string; consumerSecret: string } {
    const consumerKey = this.config.get('PESAPAL_CONSUMER_KEY', { infer: true });
    const consumerSecret = this.config.get('PESAPAL_CONSUMER_SECRET', {
      infer: true,
    });
    if (!consumerKey || !consumerSecret) {
      throw new ServiceUnavailableException('Pesapal not configured');
    }
    return { consumerKey, consumerSecret };
  }

  private baseUrl(): string {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    return isProd(nodeEnv)
      ? PESAPAL_BASE_URL.production
      : PESAPAL_BASE_URL.sandbox;
  }

  /** Returns a cached/fresh Pesapal auth token. */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt - 60_000 > now) {
      return this.tokenCache.token;
    }

    const { consumerKey, consumerSecret } = this.requireCreds();

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}/api/Auth/RequestToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          consumer_key: consumerKey,
          consumer_secret: consumerSecret,
        }),
      });
    } catch (e) {
      this.logger.error(`Pesapal auth request threw: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Pesapal authentication failed');
    }

    const body = (await response.json().catch(() => ({}))) as {
      token?: string;
      expiryDate?: string;
      error?: unknown;
    };

    if (!response.ok || !body.token) {
      this.logger.error(
        `Pesapal auth failed (${response.status}): ${JSON.stringify(body.error ?? {})}`,
      );
      throw new ServiceUnavailableException('Pesapal authentication failed');
    }

    // Pesapal tokens are valid ~5 minutes; honour expiryDate when present.
    const expiresAt = body.expiryDate
      ? new Date(body.expiryDate).getTime()
      : now + 5 * 60 * 1000;
    this.tokenCache = { token: body.token, expiresAt };
    return body.token;
  }

  /**
   * Submits an order to Pesapal and returns the tracking id + redirect URL the
   * customer must be sent to. Requires a registered IPN id (`PESAPAL_IPN_ID`)
   * and a callback URL.
   */
  async submitOrder(
    params: PesapalSubmitParams,
  ): Promise<PesapalSubmitResponse> {
    this.requireCreds();
    const ipnId = this.config.get('PESAPAL_IPN_ID', { infer: true });
    const callbackUrl =
      this.config.get('PESAPAL_CALLBACK_URL', { infer: true }) ||
      this.config.get('PESAPAL_IPN_URL', { infer: true });

    if (!ipnId) {
      this.logger.error('PESAPAL_IPN_ID missing — cannot submit order');
      throw new ServiceUnavailableException('Pesapal IPN not configured');
    }
    if (!callbackUrl) {
      this.logger.error('PESAPAL_CALLBACK_URL / PESAPAL_IPN_URL missing');
      throw new ServiceUnavailableException('Pesapal callback not configured');
    }

    const token = await this.getAccessToken();

    const payload = {
      id: params.merchantReference,
      currency: 'KES',
      amount: Math.round(params.amount * 100) / 100,
      description: params.description.slice(0, 100),
      callback_url: callbackUrl,
      notification_id: ipnId,
      billing_address: params.billing,
    };

    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl()}/api/Transactions/SubmitOrderRequest`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
    } catch (e) {
      this.logger.error(`Pesapal submit threw: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Pesapal order submission failed');
    }

    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    > & { order_tracking_id?: string; redirect_url?: string };

    // M-6 FIX: treat any non-null error object as a failure, including {} (empty
    // object). The previous check missed {} because Object.keys({}).length === 0.
    const hasError =
      body.error !== null &&
      body.error !== undefined &&
      typeof body.error === 'object';

    if (!response.ok || hasError || !body.order_tracking_id || !body.redirect_url) {
      this.logger.error(
        `Pesapal submit rejected (${response.status}): ${JSON.stringify(body.error ?? body)}`,
      );
      throw new ServiceUnavailableException('Pesapal order submission failed');
    }

    return body as unknown as PesapalSubmitResponse;
  }

  /**
   * Resolves the real, trusted status of a Pesapal transaction. This is the
   * authoritative call used by both the IPN webhook and the status endpoint —
   * never trust the IPN body.
   */
  async getTransactionStatus(
    orderTrackingId: string,
  ): Promise<PesapalTransactionStatus> {
    this.requireCreds();
    const token = await this.getAccessToken();

    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl()}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      );
    } catch (e) {
      this.logger.error(`Pesapal status threw: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Pesapal status query failed');
    }

    const body = (await response
      .json()
      .catch(() => ({}))) as PesapalTransactionStatus;

    if (!response.ok) {
      this.logger.error(
        `Pesapal status non-OK (${response.status}): ${JSON.stringify(body)}`,
      );
      throw new ServiceUnavailableException('Pesapal status query failed');
    }

    return body;
  }
}
