import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { IncomingHttpHeaders } from 'node:http';

/**
 * Channels an order can be attributed to. Mirrors `orders_source_check`
 * (migration 0043): adding one here without a migration is rejected by the
 * database, which is the point.
 */
export type ClientChannel = 'web' | 'ios' | 'android';

/** What a request says about the client that sent it. */
export interface ClientInfo {
  /**
   * The channel to attribute this request to. Anything not identified as a
   * mobile app is `web`, including a request that sends nothing: the storefront
   * predates the header and has never sent it.
   */
  channel: ClientChannel;
  /** The sanitised `X-Optex-Client` value as sent, or null when absent or unusable. */
  client: string | null;
  /** The sanitised `X-Optex-Client-Version` value (e.g. `1.0.0+3`), or null. */
  version: string | null;
}

// Deliberately tight. These values reach the request log and a database column,
// so a header is only taken at face value if it looks like a token — never as
// free text a caller controls.
const CLIENT_RE = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const VERSION_RE = /^[a-z0-9][a-z0-9._+-]{0,31}$/i;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads the client-identity headers the mobile app sends on every request
 * (SPEC-11 §9): `X-Optex-Client` (`ios` | `android`) and
 * `X-Optex-Client-Version`.
 *
 * ATTRIBUTION, NOT AUTHORISATION. The headers are supplied by the caller, so a
 * determined one can claim to be an app. The most that buys is a skewed metric;
 * nothing in the API makes a decision on this.
 */
export function parseClientInfo(headers: IncomingHttpHeaders): ClientInfo {
  const rawClient = first(headers['x-optex-client'])?.trim().toLowerCase();
  const client = rawClient && CLIENT_RE.test(rawClient) ? rawClient : null;

  const rawVersion = first(headers['x-optex-client-version'])?.trim();
  const version = rawVersion && VERSION_RE.test(rawVersion) ? rawVersion : null;

  const channel: ClientChannel = client === 'ios' || client === 'android' ? client : 'web';
  return { channel, client, version };
}

/**
 * Param decorator resolving {@link ClientInfo} from the request headers.
 *
 * @example
 *   checkout(@RequestClient() client: ClientInfo) {}
 */
export const RequestClient = createParamDecorator((_data: unknown, ctx: ExecutionContext) =>
  parseClientInfo(ctx.switchToHttp().getRequest<Request>().headers),
);
