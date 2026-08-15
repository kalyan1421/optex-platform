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
    // branch. Set the one we control and zero the rest, so `stock` is the total
    // availability regardless of how many branches the seed left behind.
    await db.from('inventory').update({ stock: 0 }).eq('product_id', data.id);
    await db
      .from('inventory')
      .update({ stock })
      .eq('product_id', data.id)
      .eq('branch_id', branchId);

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

    // Self-healing sweep. `test:e2e` runs jest with `--forceExit`, which can cut
    // `afterAll` short mid-delete — and a leaked fixture here is not inert: these
    // products are ACTIVE and some deliberately have zero stock, so they show up
    // in the shop grid and the storefront's Playwright checkout picks one and
    // gets a legitimate 409. That is exactly what happened once. Clearing the
    // slug prefix up front means a previous crashed run cannot poison this one.
    await db.from('products').delete().like('slug', 'e2e-stock-%');
  });

  afterAll(async () => {
    if (productIds.length) await db.from('products').delete().in('id', productIds);
    // Belt and braces against the same forceExit race.
    await db.from('products').delete().like('slug', 'e2e-stock-%');
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
      await db
        .from('inventory')
        .update({ stock: 2 })
        .eq('product_id', productId)
        .eq('branch_id', (b as { id: string }).id);
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
});
