import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Which channel an order came through — SPEC-11 B-2.
 *
 * The app's headline goal is "at least 35% of online orders placed in-app", and
 * `orders` recorded nothing about where an order came from, so it could not be
 * measured. The API now stamps `orders.source` from the `X-Optex-Client` header
 * at checkout.
 *
 * These go through the real `POST /checkout` — the stamp happens after
 * `place_order` commits, in the service, so a test of the column alone would
 * prove nothing about whether checkout ever writes it.
 */
describe('Order source attribution (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let categoryId: string;
  let branchId: string;

  const PASSWORD = 'TestPassword123!';
  const runId = `${Date.now()}`;
  const userIds: string[] = [];
  const productIds: string[] = [];
  let serialCounter = 0;

  const shippingAddress = {
    name: 'Source Tester',
    phone: '0712345678',
    address: '1 Test Road',
    city: 'Nairobi',
    county: 'Nairobi',
  };

  async function newAccount(): Promise<string> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `source-e2e-${runId}-${Math.floor(Math.random() * 100000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);
    return data.session!.access_token;
  }

  /** A product with exactly one unit in stock at the test branch. */
  async function stockedProduct(): Promise<string> {
    const { data, error } = await db
      .from('products')
      .insert({
        slug: `e2e-order-source-${runId}-${Math.floor(Math.random() * 100000)}`,
        sku: `E2E-SRC-${runId}-${Math.floor(Math.random() * 100000)}`,
        name: 'Source fixture',
        category_id: categoryId,
        price_kes: 5000,
        is_active: true,
      })
      .select('id')
      .single<{ id: string }>();
    if (error) throw error;
    productIds.push(data.id);

    // `deduct_stock_fifo` consumes serials, not the inventory cache (0026), so
    // real stock is a serial plus the cache kept in step with it.
    await db.from('inventory').update({ stock: 0 }).eq('product_id', data.id);
    const { error: serialError } = await db.from('product_serials').insert({
      product_id: data.id,
      serial_number: `E2E-SRC-SERIAL-${runId}-${serialCounter++}-${Math.floor(Math.random() * 1_000_000)}`,
      status: 'in_stock',
      current_branch_id: branchId,
    });
    if (serialError) throw serialError;
    await db
      .from('inventory')
      .update({ stock: 1 })
      .eq('product_id', data.id)
      .eq('branch_id', branchId);
    return data.id;
  }

  /**
   * Places a real order, optionally identifying as a client, and returns the
   * `source` the database ended up holding.
   */
  async function checkoutAs(headers: Record<string, string>): Promise<string> {
    const token = await newAccount();
    const productId = await stockedProduct();
    const auth = { Authorization: `Bearer ${token}` };

    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set(auth)
      .send({ productId, quantity: 1 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/checkout')
      .set(auth)
      .set(headers)
      .send({ paymentMethod: 'mpesa', deliveryOption: 'delivery', shippingAddress })
      .expect(201);

    const { data, error } = await db
      .from('orders')
      .select('source')
      .eq('id', res.body.order.id)
      .single<{ source: string }>();
    if (error) throw error;
    return data.source;
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

    // An existing category, not one of our own: a category cannot be deleted
    // while even a deactivated product still points at it, so inventing one here
    // left "E2E ..." chips at the head of the storefront's category row for good.
    const { data: cat } = await db
      .from('categories')
      .select('id')
      .not('slug', 'like', 'e2e-%')
      .not('slug', 'like', 'zz-%')
      .limit(1)
      .single<{ id: string }>();
    categoryId = cat!.id;

    const { data: branch } = await db
      .from('branches')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single<{ id: string }>();
    branchId = branch!.id;
  });

  // Deactivated, never deleted: a product that has been ordered has `order_items`
  // rows pointing at it, and while active it would show up in the storefront's
  // shop grid for the Playwright suite to trip over. See stock.e2e-spec.ts.
  afterAll(async () => {
    await db.from('products').update({ is_active: false }).in('id', productIds);
    for (const id of userIds) await db.auth.admin.deleteUser(id);
    await app.close();
  });

  it('records an iOS app checkout as ios', async () => {
    expect(await checkoutAs({ 'X-Optex-Client': 'ios', 'X-Optex-Client-Version': '1.0.0+7' })).toBe(
      'ios',
    );
  });

  it('records an Android app checkout as android', async () => {
    expect(await checkoutAs({ 'X-Optex-Client': 'android' })).toBe('android');
  });

  it('reads the header case-insensitively', async () => {
    expect(await checkoutAs({ 'X-Optex-Client': 'IOS' })).toBe('ios');
  });

  it('records a checkout that sends no client header as web', async () => {
    // The storefront has never sent it — this is the path every existing
    // customer takes, and it must be untouched.
    expect(await checkoutAs({})).toBe('web');
  });

  it.each([
    ['an unrecognised client', 'curl'],
    ['the framework name a pre-release build sent', 'flutter'],
    ['a value that is not a token', 'ios; drop table orders'],
    ['an oversized value', 'a'.repeat(300)],
  ])('records %s as web, and still places the order', async (_label, value) => {
    // Attribution is never a reason to refuse a checkout, and never a way to
    // write something the column does not allow.
    expect(await checkoutAs({ 'X-Optex-Client': value })).toBe('web');
  });

  it('is enforced by the database, not only by the API', async () => {
    // A channel nobody has defined a meaning for cannot be stored, whoever asks.
    const { data: someOrder } = await db
      .from('orders')
      .select('id')
      .limit(1)
      .single<{ id: string }>();
    const { error } = await db.from('orders').update({ source: 'desktop' }).eq('id', someOrder!.id);
    expect(error?.message).toMatch(/orders_source_check/);
  });
});
