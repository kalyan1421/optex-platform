import { ProductsService } from '../../src/modules/catalog/products.service';
import { ProductQueryDto } from '../../src/modules/catalog/dto/product-query.dto';
import type { SupabaseService } from '../../src/supabase/supabase.service';
import type { AuditLogService } from '../../src/modules/audit-log/audit-log.service';

/**
 * Homepage curation in `ProductsService.list` (migration 0041): when a
 * `featured`/`trending` section has nothing pinned it falls through to the
 * uncurated catalogue, and when it does have products it must NOT, on any page.
 *
 * The regression guarded here: the fallback used to be keyed on the length of
 * the requested PAGE, so `featured&limit=4&page=2` with exactly four pinned
 * products came back as ordinary newest products rather than an empty page.
 *
 * Runs against a stubbed query builder; the real query is exercised by the e2e
 * suite, which needs a live Supabase stack.
 */

type Result = { data: unknown[] | null; error: { message: string } | null; count: number | null };
type Call = [method: string, args: unknown[]];

/**
 * PostgREST builders are thenables: every method returns the builder, and
 * `await` runs the query. This records the chain and resolves to `result`.
 */
function builder(result: Result): { query: unknown; calls: Call[] } {
  const calls: Call[] = [];
  const query: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          calls.push([String(prop), args]);
          return query;
        };
      },
    },
  );
  return { query, calls };
}

const row = (id: string) => ({ id, name: `Product ${id}`, price_kes: 1000 });
const ok = (data: unknown[], count: number): Result => ({ data, error: null, count });

interface Harness {
  service: ProductsService;
  /** Chains issued against `products`, in order. */
  productQueries: Call[][];
}

/** `products` answers from `productResults` in order; `inventory` is always empty. */
function harness(productResults: Result[]): Harness {
  const productQueries: Call[][] = [];
  let next = 0;
  const from = jest.fn((table: string) => {
    if (table === 'inventory') return builder(ok([], 0)).query;
    const result = productResults[next++];
    if (!result) throw new Error(`unexpected extra query against ${table}`);
    const { query, calls } = builder(result);
    productQueries.push(calls);
    return query;
  });
  const supabase = { client: { from } } as unknown as SupabaseService;
  const service = new ProductsService(supabase, {} as AuditLogService);
  return { service, productQueries };
}

const list = (service: ProductsService, overrides: Partial<ProductQueryDto>) =>
  service.list({ page: 1, limit: 4, ...overrides } as ProductQueryDto);

const filtered = (calls: Call[], column: string) =>
  calls.some(([method, args]) => method === 'eq' && args[0] === column && args[1] === true);

describe('ProductsService.list homepage curation', () => {
  it('returns the pinned products on page 1', async () => {
    const pinned = [row('a'), row('b'), row('c'), row('d')];
    const { service, productQueries } = harness([ok(pinned, 4)]);

    const result = await list(service, { featured: true });

    expect(result.items.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(result.total).toBe(4);
    expect(productQueries).toHaveLength(1);
    expect(filtered(productQueries[0], 'is_featured')).toBe(true);
  });

  it('does not fall back to the uncurated catalogue for a later page of a pinned section', async () => {
    // Four pinned, four per page: page 2 is genuinely empty. The fallback result
    // is queued so a regression would return it instead of failing on a missing mock.
    const { service, productQueries } = harness([ok([], 4), ok([row('x'), row('y')], 15)]);

    const result = await list(service, { featured: true, page: 2 });

    expect(result).toEqual({ items: [], total: 4, page: 2, limit: 4 });
    expect(productQueries).toHaveLength(1);
  });

  it('falls back to newest-first when nothing is pinned', async () => {
    const { service, productQueries } = harness([ok([], 0), ok([row('x'), row('y')], 15)]);

    const result = await list(service, { featured: true });

    expect(result.items.map((p) => p.id)).toEqual(['x', 'y']);
    expect(result.total).toBe(15);
    expect(productQueries).toHaveLength(2);
    expect(filtered(productQueries[0], 'is_featured')).toBe(true);
    expect(filtered(productQueries[1], 'is_featured')).toBe(false);
  });

  it('keeps paginating the fallback when nothing is pinned', async () => {
    // Consistent with page 1: a section with no pins is the whole catalogue.
    const { service, productQueries } = harness([ok([], 0), ok([row('z')], 15)]);

    const result = await list(service, { featured: true, page: 2 });

    expect(result.items.map((p) => p.id)).toEqual(['z']);
    expect(result.page).toBe(2);
    expect(productQueries).toHaveLength(2);
  });

  it('curates on is_trending for the trending section', async () => {
    const { service, productQueries } = harness([ok([row('t')], 1)]);

    await list(service, { trending: true });

    expect(filtered(productQueries[0], 'is_trending')).toBe(true);
    expect(filtered(productQueries[0], 'is_featured')).toBe(false);
  });

  it('does not touch the curated path for an ordinary listing', async () => {
    const { service, productQueries } = harness([ok([row('n')], 1)]);

    await list(service, {});

    expect(productQueries).toHaveLength(1);
    expect(filtered(productQueries[0], 'is_featured')).toBe(false);
    expect(filtered(productQueries[0], 'is_trending')).toBe(false);
  });

  it('surfaces a query error instead of falling back', async () => {
    const { service } = harness([{ data: null, error: { message: 'boom' }, count: null }]);

    await expect(list(service, { featured: true })).rejects.toThrow('boom');
  });
});
