import { BadRequestException, HttpException, ServiceUnavailableException } from '@nestjs/common';

/**
 * Turning a supabase-js `error` into the right HTTP status.
 *
 * Services used to answer every PostgREST/Storage error with
 * `new BadRequestException(error.message)`. That is right when the database
 * rejected the request (bad uuid, constraint violation) and wrong when the
 * database could not be reached at all: with the Docker stack stopped or the
 * hosted project paused, supabase-js reports `TypeError: fetch failed` and the
 * API answered `400` — telling clients not to retry and keeping the outage off
 * every dashboard that counts 5xx. `apps/web/lib/api-server.js`'s
 * `readForStaticPage` deliberately skips its retry on a 4xx, so a storefront
 * build during an outage gave up immediately.
 */

/**
 * What the services read off a supabase-js error. Covers the shapes they wrap:
 *   - PostgREST's plain `{ message, details, hint, code }` object;
 *   - storage-js `upload()`'s error, which in 2.7 is the storage API's own JSON
 *     body passed through — `{ statusCode: '413', error, message }`, newer
 *     storage servers adding a `code` such as `NoSuchBucket` — despite being
 *     typed as `StorageError`;
 *   - storage-js's `StorageError` subclasses, which its other methods return
 *     (`name`, plus `status` on a `StorageApiError`).
 */
export interface SupabaseErrorLike {
  message: string;
  code?: string | null;
  name?: string;
  status?: number | string;
  statusCode?: number | string;
}

/**
 * A Postgres error code: five characters, the first two the class. Postgres's
 * classes are a digit followed by a character, or `F0` `HV` `P0` `XX`. Matching
 * the class rather than any five characters matters: a five-letter errno such as
 * `EPIPE` would otherwise read as a SQLSTATE and come back as a 400.
 */
const SQLSTATE = /^(?:[0-9][0-9A-Z]|F0|HV|P0|XX)[0-9A-Z]{3}$/;

/** PostgREST's own codes, e.g. `PGRST116`, `PGRST202`, `PGRSTX00`. */
const POSTGREST_CODE = /^PGRST[0-9A-Z]{3}$/;

/**
 * PostgREST's connection group: `PGRST000` could not connect to the database,
 * `PGRST001` database client error, `PGRST002` could not load the schema cache,
 * `PGRST003` timed out waiting for a pool connection.
 */
const POSTGREST_CONNECTION_CODE = /^PGRST00[0-3]$/;

/**
 * SQLSTATE classes that describe the database's condition, not the request's:
 * `08` connection exception, `53` insufficient resources (`53300`
 * too_many_connections), `57` operator intervention (`57014` statement
 * timeout, `57P01` admin shutdown, `57P03` cannot connect now) and `58` system
 * / I/O error. The same request would succeed later.
 */
const UNAVAILABLE_SQLSTATE_CLASSES = new Set(['08', '53', '57', '58']);

/**
 * Serialization failure and deadlock — Postgres aborted the transaction because
 * of what *other* transactions were doing, and a retry is the documented fix.
 * The rest of class `40` (e.g. `40002`, a deferred constraint failing at
 * commit) can be the request's own fault, so it is not included wholesale.
 */
const UNAVAILABLE_SQLSTATES = new Set(['40001', '40P01']);

const UNAVAILABLE_MESSAGE = 'The service is temporarily unavailable. Please try again shortly.';

/**
 * True when the error says the database or the path to it failed, rather than
 * that the database looked at the request and rejected it.
 *
 * The structural test is the `code`. Every error PostgREST produces carries a
 * SQLSTATE or a `PGRST` code — that is how a database verdict looks. An error
 * without one never came from PostgREST:
 *   - no response at all: postgrest-js turns a rejected `fetch` into
 *     `{ message: 'TypeError: fetch failed', code: '' }` (undici puts the
 *     errno on `cause`, which postgrest-js drops), or carries the errno
 *     (`ECONNREFUSED`) from other fetch implementations;
 *   - a response from something in front of PostgREST: Kong's 502 when the
 *     upstream is down, a CDN error page, a paused project — postgrest-js
 *     wraps a non-JSON body as `{ message: body }`.
 * Checking the code's shape rather than matching message text means neither
 * case depends on wording supabase-js or undici may change.
 *
 * The HTTP status PostgREST answered with would be more direct, but the
 * services destructure `{ data, error }` and the status is not on the error.
 */
export function isUpstreamUnavailable(error: SupabaseErrorLike): boolean {
  // Storage first: its `code`s (`NoSuchBucket`, `EntityTooLarge`) are neither
  // SQLSTATE nor PGRST, and would otherwise read as "not from PostgREST".
  // `StorageUnknownError` means the request failed or the body was not the
  // storage API's JSON (a gateway page); the other two carry the storage API's
  // own HTTP status.
  if (error.name === 'StorageUnknownError') return true;
  if (error.name === 'StorageApiError') return Number(error.status) >= 500;
  if (error.statusCode !== undefined) return Number(error.statusCode) >= 500;

  const code = error.code ?? '';
  if (POSTGREST_CODE.test(code)) return POSTGREST_CONNECTION_CODE.test(code);
  if (SQLSTATE.test(code)) {
    return UNAVAILABLE_SQLSTATE_CLASSES.has(code.slice(0, 2)) || UNAVAILABLE_SQLSTATES.has(code);
  }
  return true;
}

/**
 * The exception a service should throw for a supabase-js error: `503` when the
 * database is unavailable, otherwise the `400` the services have always
 * returned.
 *
 * The 503 message is fixed — a fetch failure's text is harmless, but a gateway
 * error page is not something to echo to clients — and the original error rides
 * along as `cause`, which `AllExceptionsFilter` logs. The 400 still echoes
 * `error.message`, unchanged: clients and e2e specs read it.
 */
export function toHttpException(error: SupabaseErrorLike): HttpException {
  if (isUpstreamUnavailable(error)) {
    return new ServiceUnavailableException(UNAVAILABLE_MESSAGE, { cause: error });
  }
  return new BadRequestException(error.message);
}
