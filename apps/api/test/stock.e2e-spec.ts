import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Checkout stock enforcement — audit finding F-02.
 *
 * `place_order` used to compute money impeccably and then never look at
 * `inventory`, so every product was infinitely purchasable regardless of what
 * was on the shelf. Migration 0020 added the check, the deduction, and the
 * lock that makes both meaningful under concurrency.
 *
 * The concurrency case is the one that matters and the one a single-user test
 * suite structurally cannot catch — which is precisely why the bug survived
 * 124 passing tests. `sells the last unit exactly once` fires two simultaneous
 * checkouts at one remaining unit and asserts that exactly one wins.
 */
describe('Checkout stock enforcement (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let categoryId: string;
  let branchId: string;
  const userIds: string[] = [];
  const productIds: string[] = [];

  const PASSWORD = 'TestPassword123!';
  const CATEGORY_SLUG = 'e2e-stock-category';

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function newAccount(): Promise<string> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `stock-e2e-${Date.now()}-${Math.floor(Math.random() * 100000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);
    return data.session!.access_token;
  }

  /**
   * `cancellations.decide` + `orders.cancel` (`branch_manager`) — no `aal2`
   * step-up needed, unlike `super_admin`. Deliberately no `branch_id` in
   * `app_metadata`: `orders.branch_id` is never set by `place_order` (a known
   * gap — see `adminCancel`'s own comment), so a branch-scoped caller 404s on
   * every order. `approve()` has no branch check at all either way
   * (documented gap, CLAUDE.md) — this account exists to exercise the restock
   * fix, not branch-scoping, so it's minted without a branch on purpose.
   */
  async function newBranchManager(): Promise<string> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `stock-e2e-admin-${Date.now()}-${Math.floor(Math.random() * 100000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);

    await db.auth.admin.updateUserById(data.user!.id, {
      app_metadata: { role: 'branch_manager' },
    });

    const { data: session, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (signInError) throw signInError;
    return session.session!.access_token;
  }

  let serialCounter = 0;

  /**
   * Sets stock for one product at one branch by creating `stock`
   * `product_serials` rows (status `in_stock`) and syncing the `inventory`
   * cache to match — `deduct_stock_fifo` consumes serials, not the cache
   * directly (R2, migration 0026), so a raw `inventory.update` no longer
   * simulates "this product has stock" the way it used to. Assumes the
   * target branch starts at zero stock/no serials for this product, which
   * every caller below satisfies.
   */
  async function seedStock(productId: string, targetBranchId: string, stock: number): Promise<void> {
    if (stock > 0) {
      const serials = Array.from({ length: stock }, () => ({
        product_id: productId,
        serial_number: `E2E-STK-SERIAL-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}-${serialCounter++}`,
        status: 'in_stock',
        current_branch_id: targetBranchId,
      }));
      const { error } = await db.from('product_serials').insert(serials);
      if (error) throw error;
    }
    await db
      .from('inventory')
      .update({ stock })
      .eq('product_id', productId)
      .eq('branch_id', targetBranchId);
  }

  /** Creates a product and sets its stock at the test branch to `stock`. */
  async function newProduct(name: string, stock: number, priceKes = 5000): Promise<string> {
    const { data, error } = await db
      .from('products')
      .insert({
        slug: `e2e-stock-${name}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        sku: `E2E-STK-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        name,
        category_id: categoryId,
        price_kes: priceKes,
        is_active: true,
      })
      .select('id')
      .single<{ id: string }>();
    if (error) throw error;
    productIds.push(data.id);

    // 0020's insert trigger has already created zero-stock rows at every active
    // branch. Zero them all, then seed real stock (with matching serials) only
    // at the branch under test, so `stock` is the total availability
    // regardless of how many branches the seed left behind.
    await db.from('inventory').update({ stock: 0 }).eq('product_id', data.id);
    await seedStock(data.id, branchId, stock);

    return data.id;
  }

  const shippingAddress = {
    name: 'Stock Tester',
    phone: '0712345678',
    address: '1 Test Road',
    city: 'Nairobi',
    county: 'Nairobi',
  };

  function checkout(token: string) {
    return request(app.getHttpServer())
      .post('/api/checkout')
      .set(auth(token))
      .send({ paymentMethod: 'mpesa', deliveryOption: 'delivery', shippingAddress });
  }

  async function addToCart(token: string, productId: string, quantity: number) {
    const res = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set(auth(token))
      .send({ productId, quantity });
    expect(res.status).toBe(201);
  }

  async function stockOf(productId: string): Promise<number> {
    const { data } = await db.from('inventory').select('stock').eq('product_id', productId);
    return (data ?? []).reduce((sum, r) => sum + (r as { stock: number }).stock, 0);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    db = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } },
    );

    const { data: cat } = await db
      .from('categories')
      .upsert({ slug: CATEGORY_SLUG, name: 'E2E Stock' }, { onConflict: 'slug' })
      .select('id')
      .single<{ id: string }>();
    categoryId = cat!.id;

    const { data: branch } = await db
      .from('branches')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single<{ id: string }>();
    branchId = branch!.id;

    // Self-healing sweep: retire anything a previous crashed run left visible,
    // so it cannot poison this run or the storefront suite. See the afterEach
    // below for why these are deactivated rather than deleted.
    await db.from('products').update({ is_active: false }).like('slug', 'e2e-stock-%');
  });

  // DEACTIVATED after every test, not deleted.
  //
  // Why this matters: these fixtures are ACTIVE products and several
  // deliberately have zero stock, so while they are visible they appear in the
  // shop grid — and the storefront's Playwright checkout picks a product from
  // that grid and gets a legitimate 409 from the very guard this file exists to
  // test. Two earlier attempts at cleanup both failed:
  //
  //   1. `afterAll` alone — `test:e2e` runs jest with `--forceExit`, which can
  //      cut it short mid-delete.
  //   2. `DELETE` — a product that was successfully ordered has `order_items`
  //      rows pointing at it, and that FK is not ON DELETE CASCADE. The delete
  //      failed with a constraint violation which nothing checked, so the rows
  //      survived every sweep and it looked like the sweep was not running.
  //
  // Deactivating sidesteps both. It is also what the application itself does
  // when an admin removes a product (a soft delete — see the admin e2e), so the
  // fixtures end up in exactly the state a retired product would.
  afterEach(async () => {
    if (productIds.length) {
      const { error } = await db.from('products').update({ is_active: false }).in('id', productIds);
      if (error) throw new Error(`Failed to retire stock fixtures: ${error.message}`);
      productIds.length = 0;
    }
  });

  afterAll(async () => {
    // Backstop for anything afterEach missed.
    await db.from('products').update({ is_active: false }).like('slug', 'e2e-stock-%');
    for (const id of userIds) await db.auth.admin.deleteUser(id);
    await db.from('categories').delete().eq('slug', CATEGORY_SLUG);
    await app.close();
  });

  it('creates zero-stock inventory rows for a newly created product', async () => {
    // The 0020 trigger. Without it, admin-created products would be invisible
    // in the inventory grid and permanently unpurchasable with no explanation.
    const productId = await newProduct('trigger-check', 0);
    const { data } = await db.from('inventory').select('branch_id').eq('product_id', productId);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it('reports cache/serial divergence instead of hiding it behind the stock grid', async () => {
    const productId = await newProduct('reconciliation', 0);
    const token = await newBranchManager();

    const { error } = await db.from('product_serials').insert({
      product_id: productId,
      serial_number: `E2E-RECON-${Date.now()}`,
      status: 'in_stock',
      current_branch_id: branchId,
    });
    if (error) throw error;

    const res = await request(app.getHttpServer())
      .get('/api/admin/inventory/reconciliation')
      .set(auth(token))
      .expect(200);

    expect(res.body.reconciled).toBe(false);
    expect(res.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ product_id: productId, branch_id: branchId, cached_stock: 0, serial_stock: 1, difference: -1 }),
      ]),
    );
  });

  it('refuses checkout for a product with no stock, and says so', async () => {
    const token = await newAccount();
    const productId = await newProduct('out-of-stock', 0);
    await addToCart(token, productId, 1);

    const res = await checkout(token);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/out of stock/i);
  });

  it('refuses a quantity above available stock, naming the shortfall', async () => {
    const token = await newAccount();
    const productId = await newProduct('short-stock', 2);
    await addToCart(token, productId, 5);

    const res = await checkout(token);

    expect(res.status).toBe(409);
    // The customer needs to know how many they can actually have.
    expect(res.body.message).toMatch(/only 2/i);
    expect(res.body.message).toMatch(/asked for 5/i);
  });

  it('leaves stock untouched when checkout is refused', async () => {
    const token = await newAccount();
    const productId = await newProduct('no-partial-deduct', 3);
    await addToCart(token, productId, 10);

    await checkout(token).expect(409);

    expect(await stockOf(productId)).toBe(3);
  });

  it('deducts stock when checkout succeeds', async () => {
    const token = await newAccount();
    const productId = await newProduct('deducts', 10);
    await addToCart(token, productId, 3);

    await checkout(token).expect(201);

    expect(await stockOf(productId)).toBe(7);
  });

  it('consumes the oldest received serial first (FIFO), not an arbitrary cache row', async () => {
    const token = await newAccount();
    const productId = await newProduct('fifo-receipt-order', 0);
    const stamp = Date.now();
    const olderSerial = `E2E-FIFO-OLD-${stamp}`;
    const newerSerial = `E2E-FIFO-NEW-${stamp}`;

    const { error: serialError } = await db.from('product_serials').insert([
      {
        product_id: productId,
        serial_number: olderSerial,
        status: 'in_stock',
        current_branch_id: branchId,
        received_at: '2025-01-01T00:00:00.000Z',
      },
      {
        product_id: productId,
        serial_number: newerSerial,
        status: 'in_stock',
        current_branch_id: branchId,
        received_at: '2025-02-01T00:00:00.000Z',
      },
    ]);
    if (serialError) throw serialError;
    await db.from('inventory').update({ stock: 2 }).eq('product_id', productId).eq('branch_id', branchId);

    await addToCart(token, productId, 1);
    await checkout(token).expect(201);

    const { data: serials, error } = await db
      .from('product_serials')
      .select('serial_number, status')
      .eq('product_id', productId)
      .order('received_at');
    if (error) throw error;

    expect(serials?.find((serial) => serial.serial_number === olderSerial)?.status).toBe('sold');
    expect(serials?.find((serial) => serial.serial_number === newerSerial)?.status).toBe('in_stock');
  });

  it('draws a single line across several branches when no one branch can cover it', async () => {
    // Availability is the sum across active branches (orders carry no
    // fulfilment branch), so a line larger than any single branch's holding
    // must still succeed while the total covers it.
    const { data: branches } = await db
      .from('branches')
      .select('id')
      .eq('is_active', true)
      .limit(2);
    if (!branches || branches.length < 2) return; // single-branch seed: nothing to prove

    const token = await newAccount();
    const productId = await newProduct('multi-branch', 0);
    for (const b of branches) {
      await seedStock(productId, (b as { id: string }).id, 2);
    }

    await addToCart(token, productId, 3);
    await checkout(token).expect(201);

    expect(await stockOf(productId)).toBe(1);
  });

  it('sells the last unit exactly once under concurrent checkout', async () => {
    // THE REGRESSION THIS FILE EXISTS FOR. Two customers, one unit, both
    // checking out at the same moment. Before 0020 both succeeded and the shop
    // owed a frame it did not have; the row lock now serialises them.
    const productId = await newProduct('last-unit', 1);
    const [tokenA, tokenB] = await Promise.all([newAccount(), newAccount()]);
    await addToCart(tokenA, productId, 1);
    await addToCart(tokenB, productId, 1);

    const [resA, resB] = await Promise.all([checkout(tokenA), checkout(tokenB)]);
    const statuses = [resA.status, resB.status].sort();

    expect(statuses).toEqual([201, 409]);
    expect(await stockOf(productId)).toBe(0);
  });

  describe('cancellation restocking (R2)', () => {
    it('approving a cancellation releases the specific serials that were sold, back to in_stock', async () => {
      const token = await newAccount();
      const productId = await newProduct('restock', 5);
      await addToCart(token, productId, 2);

      const checkoutRes = await checkout(token).expect(201);
      const orderId: string = checkoutRes.body.order.id;
      expect(await stockOf(productId)).toBe(3);

      const { data: soldSerials } = await db
        .from('product_serials')
        .select('id, status, current_branch_id')
        .eq('product_id', productId)
        .eq('status', 'sold');
      expect(soldSerials).toHaveLength(2);
      const soldIds = (soldSerials ?? []).map((s) => (s as { id: string }).id);

      const requestRes = await request(app.getHttpServer())
        .post(`/api/orders/${orderId}/cancellation`)
        .set(auth(token))
        .send({})
        .expect(201);
      const requestId: string = requestRes.body.id;

      const adminToken = await newBranchManager();
      await request(app.getHttpServer())
        .patch(`/api/admin/cancellations/${requestId}/approve`)
        .set(auth(adminToken))
        .send({})
        .expect(200);

      expect(await stockOf(productId)).toBe(5);

      const { data: releasedSerials } = await db
        .from('product_serials')
        .select('id, status, current_branch_id')
        .in('id', soldIds);
      for (const serial of releasedSerials ?? []) {
        expect((serial as { status: string }).status).toBe('in_stock');
        expect((serial as { current_branch_id: string }).current_branch_id).toBe(branchId);
      }

      const { data: orderItems, error: orderItemsError } = await db
        .from('order_items')
        .select('id')
        .eq('order_id', orderId);
      if (orderItemsError) throw orderItemsError;

      const orderItemIds = (orderItems ?? []).map((item) => item.id);
      const { data: soldLedger } = await db
        .from('stock_ledger')
        .select('serial_id')
        .eq('movement_type', 'sold')
        .eq('reference_type', 'order_item')
        .in('reference_id', orderItemIds);
      expect(soldLedger).toHaveLength(2);

      const { data: reversedLedger } = await db
        .from('stock_ledger')
        .select('serial_id, movement_type, reference_type, reference_id, actor_user_id, actor_role')
        .eq('movement_type', 'sale_reversed')
        .eq('reference_type', 'order_item')
        .in('reference_id', orderItemIds);
      expect(reversedLedger).toHaveLength(2);
      for (const row of reversedLedger ?? []) {
        expect((row as { actor_user_id: string | null }).actor_user_id).not.toBeNull();
        expect((row as { actor_role: string | null }).actor_role).toBe('branch_manager');
      }
    });

    it('approving twice does not double-credit stock (idempotent restock)', async () => {
      const token = await newAccount();
      const productId = await newProduct('restock-idempotent', 3);
      await addToCart(token, productId, 1);
      const checkoutRes = await checkout(token).expect(201);
      const orderId: string = checkoutRes.body.order.id;

      const adminToken = await newBranchManager();
      // Direct-cancel path (adminCancel), no pending request needed — exercises
      // the transactional cancellation-and-restock RPC.
      await request(app.getHttpServer())
        .patch(`/api/admin/orders/${orderId}/cancel`)
        .set(auth(adminToken))
        .send({})
        .expect(200);
      expect(await stockOf(productId)).toBe(3);

      // Calling the RPC again directly (simulating a retried/duplicate restock)
      // must not credit stock a second time.
      await db.rpc('restock_cancelled_order', {
        p_order_id: orderId,
        p_actor_id: userIds.at(-1)!,
        p_actor_role: 'branch_manager',
      });
      expect(await stockOf(productId)).toBe(3);
    });
  });
});
