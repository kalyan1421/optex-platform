import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { AllExceptionsFilter } from '../../src/common/all-exceptions.filter';
import {
  isUpstreamUnavailable,
  toHttpException,
  type SupabaseErrorLike,
} from '../../src/common/supabase-error';

/**
 * Unit tests for the supabase-js error → HTTP status mapping.
 *
 * The errors are produced by the real installed supabase-js client with
 * `fetch` stubbed out, not hand-written — the classification depends on the
 * exact shape postgrest-js and storage-js give a network failure or a gateway
 * page, and a supabase-js upgrade that changes that shape should fail here
 * rather than quietly turning outages back into 400s.
 */

type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function clientWith(fetch: FetchStub) {
  return createClient('http://supabase.test', 'service-role-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
}

const json =
  (status: number, body: unknown): FetchStub =>
  async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

const text =
  (status: number, body: string): FetchStub =>
  async () =>
    new Response(body, { status, headers: { 'Content-Type': 'text/html' } });

const rejects =
  (error: unknown): FetchStub =>
  async () => {
    throw error;
  };

/** Undici's error when nothing is listening — the case observed on 2026-10-16. */
const fetchFailed = () =>
  Object.assign(new TypeError('fetch failed'), {
    cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:54321'), {
      code: 'ECONNREFUSED',
    }),
  });

async function selectError(fetch: FetchStub): Promise<SupabaseErrorLike> {
  const { error } = await clientWith(fetch).from('products').select('id').limit(2);
  if (!error) throw new Error('expected the query to fail');
  return error;
}

async function uploadError(fetch: FetchStub): Promise<SupabaseErrorLike> {
  const { error } = await clientWith(fetch)
    .storage.from('prescriptions')
    .upload('customer/file.pdf', Buffer.from('%PDF-1.4'), { contentType: 'application/pdf' });
  if (!error) throw new Error('expected the upload to fail');
  return error;
}

/** A PostgREST error body, as PostgREST itself sends it. */
const postgrest = (code: string, message = `error ${code}`) => ({
  code,
  message,
  details: null,
  hint: null,
});

describe('toHttpException — the database could not be reached', () => {
  it('maps fetch failed (stack down, project paused) to 503', async () => {
    const error = await selectError(rejects(fetchFailed()));
    expect(error.message).toBe('TypeError: fetch failed');

    const exception = toHttpException(error);
    expect(exception).toBeInstanceOf(ServiceUnavailableException);
    expect(exception.getStatus()).toBe(503);
    expect(exception.cause).toBe(error);
  });

  it('does not echo the underlying error to the client', async () => {
    const exception = toHttpException(await selectError(rejects(fetchFailed())));
    expect(exception.message).not.toContain('fetch');
  });

  it('maps a fetch implementation that reports the errno as the code to 503', async () => {
    const nodeFetchError = Object.assign(
      new Error(
        'request to http://supabase.test/rest/v1/products failed, reason: connect ECONNREFUSED',
      ),
      { name: 'FetchError', code: 'ECONNREFUSED' },
    );
    const error = await selectError(rejects(nodeFetchError));
    expect(error.code).toBe('ECONNREFUSED');
    expect(toHttpException(error).getStatus()).toBe(503);
  });

  it('maps an aborted or timed-out request to 503', async () => {
    for (const reason of [
      new DOMException('This operation was aborted', 'AbortError'),
      new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    ]) {
      expect(toHttpException(await selectError(rejects(reason))).getStatus()).toBe(503);
    }
  });

  it('maps a gateway error page in front of PostgREST to 503 without echoing it', async () => {
    const page = '<html><body><h1>502 Bad Gateway</h1>cloudflare</body></html>';
    const error = await selectError(text(502, page));
    expect(error.message).toBe(page);

    const exception = toHttpException(error);
    expect(exception.getStatus()).toBe(503);
    expect(JSON.stringify(exception.getResponse())).not.toContain('cloudflare');
  });

  it("maps Kong's JSON error with no PostgREST code to 503", async () => {
    const error = await selectError(
      json(502, { message: 'An invalid response was received from the upstream server' }),
    );
    expect(toHttpException(error).getStatus()).toBe(503);
  });

  it.each([
    ['PGRST000', 'Could not connect with the database'],
    ['PGRST001', 'Database client error'],
    ['PGRST002', 'Could not query the database for the schema cache'],
    ['PGRST003', 'Timed out acquiring connection from connection pool'],
  ])('maps PostgREST %s (%s) to 503', async (code, message) => {
    const error = await selectError(json(503, postgrest(code, message)));
    expect(toHttpException(error).getStatus()).toBe(503);
  });

  it.each([
    ['08006', 'connection_failure'],
    ['53300', 'too_many_connections'],
    ['57014', 'query_canceled (statement timeout)'],
    ['57P01', 'admin_shutdown'],
    ['57P03', 'cannot_connect_now'],
    ['58030', 'io_error'],
    ['40001', 'serialization_failure'],
    ['40P01', 'deadlock_detected'],
  ])('maps SQLSTATE %s (%s) to 503', async (code) => {
    const error = await selectError(json(500, postgrest(code)));
    expect(toHttpException(error).getStatus()).toBe(503);
  });
});

describe('toHttpException — the database rejected the request', () => {
  it.each([
    ['22P02', 'invalid input syntax for type uuid: "not-a-uuid"'],
    ['22001', 'value too long for type character varying(120)'],
    ['23502', 'null value in column "name" violates not-null constraint'],
    ['23503', 'insert or update on table "cart_items" violates foreign key constraint'],
    ['23505', 'duplicate key value violates unique constraint "products_slug_key"'],
    ['23514', 'new row violates check constraint "orders_source_check"'],
    ['P0001', 'Insufficient stock for product'],
    ['40002', 'transaction_integrity_constraint_violation'],
    ['42703', 'column products.nope does not exist'],
    ['PGRST100', 'failed to parse filter'],
    ['PGRST116', 'JSON object requested, multiple (or no) rows returned'],
  ])('keeps %s as 400 with the database message', async (code, message) => {
    const error = await selectError(json(400, postgrest(code, message)));

    const exception = toHttpException(error);
    expect(exception).toBeInstanceOf(BadRequestException);
    expect(exception.message).toBe(message);
  });

  it("keeps postgrest-js's own maybeSingle() error as 400", async () => {
    const { error } = await clientWith(json(200, [{ id: 'a' }, { id: 'b' }]))
      .from('products')
      .select('id')
      .maybeSingle();
    expect(error?.code).toBe('PGRST116');
    expect(toHttpException(error!).getStatus()).toBe(400);
  });
});

/** A storage API error body; newer storage servers add a `code`. */
const storage = (status: number, message: string, code?: string) => ({
  statusCode: String(status),
  ...(code ? { code } : {}),
  error: 'Error',
  message,
});

describe('toHttpException — storage upload() (the three wrapped call sites)', () => {
  // storage-js 2.7's upload() hands back the storage API's JSON body as the
  // error, not a StorageApiError — the status is only in its `statusCode`.

  it.each([500, 502, 503, 504])('maps a storage API %i to 503', async (status) => {
    const error = await uploadError(
      json(status, storage(status, 'storage failed', 'InternalError')),
    );
    expect(error.statusCode).toBe(String(status));
    expect(toHttpException(error).getStatus()).toBe(503);
  });

  it("maps Kong's JSON error in front of storage to 503", async () => {
    const error = await uploadError(
      json(502, { message: 'An invalid response was received from the upstream server' }),
    );
    expect(toHttpException(error).getStatus()).toBe(503);
  });

  it.each([
    [400, 'The object exceeded the maximum allowed size', undefined],
    [413, 'The object exceeded the maximum allowed size', 'EntityTooLarge'],
    [404, 'Bucket not found', 'NoSuchBucket'],
    [409, 'The resource already exists', 'Duplicate'],
    [415, 'mime type application/zip is not supported', 'InvalidMimeType'],
  ])('keeps a storage API %i as 400 with its message: %s', async (status, message, code) => {
    const error = await uploadError(json(status, storage(status, message, code)));
    const exception = toHttpException(error);
    expect(exception.getStatus()).toBe(400);
    expect(exception.message).toBe(message);
  });

  it('throws on a network failure instead of returning it', async () => {
    // So the call sites' `if (uploadError)` never sees it: it propagates to
    // AllExceptionsFilter as a non-HttpException, which is already a 500.
    await expect(uploadError(rejects(fetchFailed()))).rejects.toThrow('fetch failed');
  });
});

describe('toHttpException — storage StorageError classes', () => {
  // The other storage-js methods (createSignedUrl, download, remove) return
  // StorageApiError / StorageUnknownError. No call site wraps them in
  // toHttpException yet; this keeps the helper right for when one does, or when
  // a storage-js upgrade moves upload() onto the same path.
  async function signError(fetch: FetchStub): Promise<SupabaseErrorLike> {
    const { error } = await clientWith(fetch)
      .storage.from('prescriptions')
      .createSignedUrl('customer/file.pdf', 60);
    if (!error) throw new Error('expected signing to fail');
    return error;
  }

  it('maps a network failure (StorageUnknownError) to 503', async () => {
    const error = await signError(rejects(fetchFailed()));
    expect(error.name).toBe('StorageUnknownError');
    expect(toHttpException(error).getStatus()).toBe(503);
  });

  it('maps a gateway page instead of storage JSON (StorageUnknownError) to 503', async () => {
    const error = await signError(text(502, '<html>Bad Gateway</html>'));
    expect(error.name).toBe('StorageUnknownError');
    expect(toHttpException(error).getStatus()).toBe(503);
  });

  it('maps a 5xx StorageApiError to 503', async () => {
    const error = await signError(json(503, storage(503, 'storage failed')));
    expect(error.name).toBe('StorageApiError');
    expect(toHttpException(error).getStatus()).toBe(503);
  });

  it('keeps a 4xx StorageApiError as 400 with its message', async () => {
    const error = await signError(json(400, storage(400, 'Object not found', 'NoSuchKey')));
    expect(error.name).toBe('StorageApiError');
    const exception = toHttpException(error);
    expect(exception.getStatus()).toBe(400);
    expect(exception.message).toBe('Object not found');
  });
});

describe('isUpstreamUnavailable', () => {
  it('does not mistake a five-letter errno for a SQLSTATE', () => {
    // `EPIPE` is five upper-case letters, the same shape as `22P02`; read as a
    // SQLSTATE it would fall outside the unavailable classes and come back 400.
    expect(isUpstreamUnavailable({ message: 'FetchError: write EPIPE', code: 'EPIPE' })).toBe(true);
    expect(isUpstreamUnavailable({ message: 'FetchError: read EBADF', code: 'EBADF' })).toBe(true);
  });

  it('still recognises the letter-prefixed SQLSTATE classes as database verdicts', () => {
    expect(isUpstreamUnavailable({ message: 'raise_exception', code: 'P0001' })).toBe(false);
    expect(isUpstreamUnavailable({ message: 'internal_error', code: 'XX000' })).toBe(false);
  });
});

describe('AllExceptionsFilter with a 503 from toHttpException', () => {
  function hostFor(url: string) {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const request = { method: 'GET', url, headers: {} };
    const host = {
      switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    } as unknown as ArgumentsHost;
    return { host, response };
  }

  afterEach(() => jest.restoreAllMocks());

  it('answers 503 SERVICE_UNAVAILABLE and logs the underlying error', async () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const error = await selectError(json(503, postgrest('PGRST001', 'Database client error')));
    const { host, response } = hostFor('/api/products?limit=2');

    new AllExceptionsFilter().catch(toHttpException(error), host);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'The service is temporarily unavailable. Please try again shortly.',
      }),
    );
    expect(logged).toHaveBeenCalledWith(
      'GET /api/products?limit=2 -> 503 (cause: [PGRST001] Database client error)',
      expect.any(String),
    );
  });
});
