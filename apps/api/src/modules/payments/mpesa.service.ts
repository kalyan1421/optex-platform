import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import {
  MPESA_BASE_URL,
  darajaTimestamp,
  isProd,
} from './payments.constants';

/** Cached Daraja OAuth token + its absolute expiry (epoch ms). */
interface CachedToken {
  token: string;
  expiresAt: number;
}

/** Shape of a Daraja STK push initiation request. */
export interface StkPushParams {
  /** Amount in KES (whole shillings — Daraja rounds; we send an integer). */
  amount: number;
  /** Payer MSISDN, already normalized to `2547XXXXXXXX`. */
  phone: string;
  /** Goes into AccountReference (max 12 chars) — the order number. */
  accountReference: string;
  /** Shown to the payer on their handset. */
  transactionDesc: string;
}

/** Parsed STK push initiation response from Daraja. */
export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

/** Parsed STK query response from Daraja. */
export interface StkQueryResponse {
  ResponseCode?: string;
  ResponseDescription?: string;
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: string;
  ResultDesc?: string;
}

/**
 * Safaricom Daraja (M-Pesa) client.
 *
 * MISSING-CREDS CONTRACT: the constructor never touches the network and never
 * throws. Every method that needs credentials calls `requireCreds()` which
 * throws `ServiceUnavailableException('M-Pesa not configured')` at call time
 * when any required key is empty — so the app boots + serves other modules
 * without M-Pesa creds, and only the M-Pesa endpoints fail (cleanly).
 *
 * Exported by `PaymentsModule` so the upcoming Cron module can reuse this Daraja
 * client (OAuth + `stkQuery`) for unattended status polling.
 */
@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);
  private tokenCache: CachedToken | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  /** True when every credential needed to talk to Daraja is present. */
  isConfigured(): boolean {
    return Boolean(
      this.config.get('MPESA_CONSUMER_KEY', { infer: true }) &&
        this.config.get('MPESA_CONSUMER_SECRET', { infer: true }) &&
        this.config.get('MPESA_SHORTCODE', { infer: true }) &&
        this.config.get('MPESA_PASSKEY', { infer: true }),
    );
  }

  private requireCreds(): {
    consumerKey: string;
    consumerSecret: string;
    shortcode: string;
    passkey: string;
    callbackUrl: string;
  } {
    const consumerKey = this.config.get('MPESA_CONSUMER_KEY', { infer: true });
    const consumerSecret = this.config.get('MPESA_CONSUMER_SECRET', {
      infer: true,
    });
    const shortcode = this.config.get('MPESA_SHORTCODE', { infer: true });
    const passkey = this.config.get('MPESA_PASSKEY', { infer: true });
    const callbackUrl = this.config.get('MPESA_CALLBACK_URL', { infer: true });

    if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
      throw new ServiceUnavailableException('M-Pesa not configured');
    }
    return { consumerKey, consumerSecret, shortcode, passkey, callbackUrl };
  }

  private baseUrl(): string {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    return isProd(nodeEnv) ? MPESA_BASE_URL.production : MPESA_BASE_URL.sandbox;
  }

  /**
   * Returns a valid OAuth bearer token, reusing the cached one until ~60s
   * before expiry. Throws `ServiceUnavailableException` if creds are missing or
   * Daraja rejects the request.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt - 60_000 > now) {
      return this.tokenCache.token;
    }

    const { consumerKey, consumerSecret } = this.requireCreds();
    const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
      'base64',
    );

    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${basic}`,
            Accept: 'application/json',
          },
        },
      );
    } catch (e) {
      this.logger.error(`Daraja OAuth request threw: ${(e as Error).message}`);
      throw new ServiceUnavailableException('M-Pesa authentication failed');
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(`Daraja OAuth failed (${response.status}): ${detail}`);
      throw new ServiceUnavailableException('M-Pesa authentication failed');
    }

    const body = (await response.json()) as {
      access_token?: string;
      expires_in?: string | number;
    };
    if (!body.access_token) {
      throw new ServiceUnavailableException('M-Pesa authentication failed');
    }

    // M-5 FIX: guard against NaN — Number() of a non-numeric string produces NaN,
    // which would make every cache hit miss immediately (NaN arithmetic is always NaN).
    const parsedTtl = Number(body.expires_in);
    const ttlSeconds = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 3599;
    this.tokenCache = {
      token: body.access_token,
      expiresAt: now + ttlSeconds * 1000,
    };
    return body.access_token;
  }

  /**
   * Initiates an STK push (Lipa Na M-Pesa Online). Returns Daraja's
   * Merchant/CheckoutRequestID so the caller can persist them as the
   * idempotency anchor before the async callback arrives.
   */
  async stkPush(params: StkPushParams): Promise<StkPushResponse> {
    const { shortcode, passkey, callbackUrl } = this.requireCreds();
    if (!callbackUrl) {
      this.logger.error('MPESA_CALLBACK_URL is empty — STK callback cannot be delivered');
      throw new ServiceUnavailableException('M-Pesa callback URL not configured');
    }

    const token = await this.getAccessToken();
    const timestamp = darajaTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
      'base64',
    );

    // Daraja rejects fractional amounts on the paybill rails; round to whole KES.
    const amount = Math.max(1, Math.round(params.amount));

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: params.phone,
      PartyB: shortcode,
      PhoneNumber: params.phone,
      CallBackURL: callbackUrl,
      AccountReference: params.accountReference.slice(0, 12),
      TransactionDesc: params.transactionDesc.slice(0, 13),
    };

    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl()}/mpesa/stkpush/v1/processrequest`,
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
      this.logger.error(`Daraja STK push threw: ${(e as Error).message}`);
      throw new ServiceUnavailableException('M-Pesa STK push failed');
    }

    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!response.ok || body.ResponseCode !== '0') {
      const desc =
        (body.errorMessage as string) ??
        (body.ResponseDescription as string) ??
        `HTTP ${response.status}`;
      this.logger.error(`Daraja STK push rejected: ${desc}`);
      throw new ServiceUnavailableException(`M-Pesa STK push failed: ${desc}`);
    }

    return body as unknown as StkPushResponse;
  }

  /**
   * Queries the status of a previously-initiated STK push.
   * Daraja returns ResultCode `0` for success; non-zero (or `1032` for
   * cancelled, `1037` timeout, etc.) indicates failure.
   */
  async stkQuery(checkoutRequestId: string): Promise<StkQueryResponse> {
    const { shortcode, passkey } = this.requireCreds();
    const token = await this.getAccessToken();
    const timestamp = darajaTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
      'base64',
    );

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}/mpesa/stkpushquery/v1/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        }),
      });
    } catch (e) {
      this.logger.error(`Daraja STK query threw: ${(e as Error).message}`);
      throw new ServiceUnavailableException('M-Pesa status query failed');
    }

    const body = (await response.json().catch(() => ({}))) as StkQueryResponse;

    // Daraja returns 500 with errorCode 500.001.1001 while the push is still
    // "being processed" — surface the parsed body so the caller can treat it as
    // "still pending" rather than a hard failure.
    if (!response.ok && body.ResultCode === undefined) {
      const detail = JSON.stringify(body);
      this.logger.warn(`Daraja STK query non-OK (${response.status}): ${detail}`);
    }

    return body;
  }
}
