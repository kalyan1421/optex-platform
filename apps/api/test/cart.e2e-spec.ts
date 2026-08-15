import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Server-side cart — `GET/POST /cart`, `PATCH/DELETE /cart/items/:id`,
 * `POST /cart/apply-promo`, `DELETE /cart/promo`.
 *
 * Only "add a product" had coverage before this file (`smoke.spec.ts`,
 * browser-level). Everything else — update quantity, remove, the increment
 * on re-add, promo validation and its VAT interaction, cross-customer
 * isolation — was unverified. Money math here is asserted to the cent: VAT is
 * charged on the *post-discount* base, and that arithmetic existing in one
 * place (`CartService.buildCartView`) rather than duplicated is exactly the
 * kind of thing a test should pin down.
 */
describe('Cart (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let token: string;
  let otherToken: string;
  let categoryId: string;
  let productAId: string; // 10,000 KES — round numbers make VAT math legible
  let productBId: string; // 2,500 KES
  let inactiveProductId: string;
  const userIds: string[] = [];

  const PASSWORD = 'TestPassword123!';
  const CATEGORY_SLUG = 'e2e-cart-category';

  /**
   * Capturing `id` (not just `email`) is what lets `afterAll` delete the
   * `auth.users` row directly instead of looking up `customers` by email —
   * `customers.auth_user_id` cascades, and so do `carts`/`cart_items` from
   * `customers`, so deleting the auth user is enough on its own.
   */
  async function newAccount(): Promise<{ token: string; email: string }> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `cart-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);
    return { token: data.session!.access_token, email };
  }

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

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

    const primary = await newAccount();
    token = primary.token;
    const other = await newAccount();
    otherToken = other.token;

    await db.from('categories').delete().eq('slug', CATEGORY_SLUG);
    const { data: category, error: catError } = await db
      .from('categories')
      .insert({ slug: CATEGORY_SLUG, name: 'E2E Cart Category' })
      .select('id')
      .single();
    if (catError) throw catError;
    categoryId = category!.id;

    const seedProduct = async (sku: string, priceKes: number, isActive = true) => {
      await db.from('products').delete().eq('sku', sku);
      const { data, error } = await db
        .from('products')
        .insert({
          sku,
          slug: `${sku.toLowerCase()}-e2e`,
          name: `E2E Cart Product ${sku}`,
          category_id: categoryId,
          price_kes: priceKes,
          is_active: isActive,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data!.id as string;
    };

    productAId = await seedProduct('E2E-CART-A', 10000);
    productBId = await seedProduct('E2E-CART-B', 2500);
    inactiveProductId = await seedProduct('E2E-CART-INACTIVE', 5000, false);
  });

  afterAll(async () => {
    // Order matters: `cart_items.product_id` and `products.category_id` are
    // both plain FKs (default RESTRICT) — deleting a product while a
    // cart_items row still references it, or the category while a product
    // still does, fails *silently* here (none of these calls check `error`),
    // which corrupts the next run's `beforeAll` with a stale row it can't
    // re-insert over. Cart lines first (via the auth-user cascade), then
    // products, then the category.
    //
    // `carts.customer_id` and `cart_items.cart_id` are both ON DELETE
    // CASCADE, and so is `customers.auth_user_id` — deleting the auth user
    // is enough to take the whole chain with it, no manual walk needed.
    for (const id of userIds) {
      await db.auth.admin.deleteUser(id);
    }
    await db.from('products').delete().in('sku', ['E2E-CART-A', 'E2E-CART-B', 'E2E-CART-INACTIVE']);
    await db.from('categories').delete().eq('slug', CATEGORY_SLUG);
    await app.close();
  });

  it('requires authentication for every cart route', async () => {
    await request(app.getHttpServer()).get('/api/cart').expect(401);
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .send({ productId: productAId })
      .expect(401);
  });

  it('starts empty', async () => {
    const res = await request(app.getHttpServer()).get('/api/cart').set(auth(token)).expect(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.itemCount).toBe(0);
    expect(Number(res.body.subtotalKes)).toBe(0);
    expect(Number(res.body.totalKes)).toBe(0);
  });

  it('refuses to add a product that does not exist or is inactive', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set(auth(token))
      .send({ productId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set(auth(token))
      .send({ productId: inactiveProductId })
      .expect(404);
  });

  it('adds a product, and computes VAT on the subtotal with no discount', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set(auth(token))
      .send({ productId: productAId })
      .expect(201);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(1);
    expect(Number(res.body.subtotalKes)).toBe(10000);
    expect(Number(res.body.discountKes)).toBe(0);
    // 16% VAT on 10,000 = 1,600.
    expect(Number(res.body.vatKes)).toBe(1600);
    expect(Number(res.body.totalKes)).toBe(11600);
  });

  it('adding the same product again increments the existing line, not a duplicate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set(auth(token))
      .send({ productId: productAId, quantity: 2 })
      .expect(201);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(3); // 1 (previous test) + 2
    expect(Number(res.body.subtotalKes)).toBe(30000);
  });

  it('adding a second, different product creates a second line', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set(auth(token))
      .send({ productId: productBId })
      .expect(201);

    expect(res.body.items).toHaveLength(2);
    expect(Number(res.body.subtotalKes)).toBe(32500); // 30,000 + 2,500
  });

  it('sets an absolute quantity via PATCH', async () => {
    const cart = await request(app.getHttpServer()).get('/api/cart').set(auth(token)).expect(200);
    const lineA = cart.body.items.find((i: { productId: string }) => i.productId === productAId);

    const res = await request(app.getHttpServer())
      .patch(`/api/cart/items/${lineA.id}`)
      .set(auth(token))
      .send({ quantity: 1 })
      .expect(200);

    const updatedLineA = res.body.items.find(
      (i: { productId: string }) => i.productId === productAId,
    );
    expect(updatedLineA.quantity).toBe(1);
    expect(Number(res.body.subtotalKes)).toBe(12500); // 10,000 + 2,500
  });

  it('setting quantity to 0 removes the line entirely', async () => {
    const cart = await request(app.getHttpServer()).get('/api/cart').set(auth(token)).expect(200);
    const lineB = cart.body.items.find((i: { productId: string }) => i.productId === productBId);

    const res = await request(app.getHttpServer())
      .patch(`/api/cart/items/${lineB.id}`)
      .set(auth(token))
      .send({ quantity: 0 })
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(Number(res.body.subtotalKes)).toBe(10000);
  });

  it('removes a line via DELETE', async () => {
    const cart = await request(app.getHttpServer()).get('/api/cart').set(auth(token)).expect(200);
    const lineA = cart.body.items[0];

    const res = await request(app.getHttpServer())
      .delete(`/api/cart/items/${lineA.id}`)
      .set(auth(token))
      .expect(200);

    expect(res.body.items).toHaveLength(0);
    expect(Number(res.body.totalKes)).toBe(0);
  });

  it('404s updating a well-formed but nonexistent cart item', async () => {
    await request(app.getHttpServer())
      .patch('/api/cart/items/00000000-0000-0000-0000-000000000000')
      .set(auth(token))
      .send({ quantity: 1 })
      .expect(404);
  });

  describe('cross-customer isolation', () => {
    it('a second customer has their own, separate empty cart', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/cart')
        .set(auth(otherToken))
        .expect(200);
      expect(res.body.items).toHaveLength(0);
    });

    it('refuses to act on another customer’s cart line', async () => {
      const added = await request(app.getHttpServer())
        .post('/api/cart/items')
        .set(auth(token))
        .send({ productId: productAId })
        .expect(201);
      const mine = added.body.items[0].id;

      // The service throws Forbidden (403) rather than the "same 404 either
      // way" pattern used elsewhere in this codebase (orders, appointments,
      // prescriptions) — this does confirm the item id exists to a caller who
      // doesn't own it. Cart item ids are unguessable UUIDs, so this isn't
      // exploitable, but it's worth pinning the actual behaviour down rather
      // than assuming it matches the rest of the API.
      await request(app.getHttpServer())
        .patch(`/api/cart/items/${mine}`)
        .set(auth(otherToken))
        .send({ quantity: 1 })
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/api/cart/items/${mine}`)
        .set(auth(otherToken))
        .expect(403);

      // Clean up for the tests that follow.
      await request(app.getHttpServer())
        .delete(`/api/cart/items/${mine}`)
        .set(auth(token))
        .expect(200);
    });
  });

  describe('promo codes', () => {
    const PERCENT_CODE = 'E2E-CART-PERCENT10';
    const FIXED_CODE = 'E2E-CART-FIXED500';
    const EXPIRED_CODE = 'E2E-CART-EXPIRED';
    const EXHAUSTED_CODE = 'E2E-CART-EXHAUSTED';

    beforeAll(async () => {
      await db
        .from('promo_codes')
        .delete()
        .in('code', [PERCENT_CODE, FIXED_CODE, EXPIRED_CODE, EXHAUSTED_CODE]);
      // PostgREST batch-inserts use the union of keys across every row in the
      // array; a row that omits a key gets an explicit `null` for it rather
      // than falling through to the column default. `uses` has to be present
      // on every row here, not just the one that needs a non-default value,
      // or the insert 23502s on the DEFAULT-relying rows.
      const { error: promoInsertError } = await db.from('promo_codes').insert([
        { code: PERCENT_CODE, discount_type: 'percent', value: 10, uses: 0 },
        { code: FIXED_CODE, discount_type: 'fixed', value: 500, uses: 0 },
        {
          code: EXPIRED_CODE,
          discount_type: 'fixed',
          value: 500,
          uses: 0,
          expires_at: '2020-01-01T00:00:00Z',
        },
        { code: EXHAUSTED_CODE, discount_type: 'fixed', value: 500, max_uses: 1, uses: 1 },
      ]);
      if (promoInsertError) throw promoInsertError;
    });

    afterAll(async () => {
      await db
        .from('promo_codes')
        .delete()
        .in('code', [PERCENT_CODE, FIXED_CODE, EXPIRED_CODE, EXHAUSTED_CODE]);
    });

    beforeEach(async () => {
      // A known cart: one line, 10,000 KES, no promo.
      const cart = await request(app.getHttpServer()).get('/api/cart').set(auth(token)).expect(200);
      for (const item of cart.body.items) {
        await request(app.getHttpServer())
          .delete(`/api/cart/items/${item.id}`)
          .set(auth(token))
          .expect(200);
      }
      await request(app.getHttpServer()).delete('/api/cart/promo').set(auth(token)).expect(200);
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set(auth(token))
        .send({ productId: productAId })
        .expect(201);
    });

    it('rejects an unknown code', async () => {
      await request(app.getHttpServer())
        .post('/api/cart/apply-promo')
        .set(auth(token))
        .send({ code: 'NO-SUCH-CODE' })
        .expect(400);
    });

    it('rejects an expired code', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/cart/apply-promo')
        .set(auth(token))
        .send({ code: EXPIRED_CODE })
        .expect(400);
      expect(res.body.message).toMatch(/expired/i);
    });

    it('rejects a code that has reached its usage limit', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/cart/apply-promo')
        .set(auth(token))
        .send({ code: EXHAUSTED_CODE })
        .expect(400);
      expect(res.body.message).toMatch(/usage limit/i);
    });

    it('applies a percent discount and taxes only the post-discount base', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/cart/apply-promo')
        .set(auth(token))
        .send({ code: PERCENT_CODE.toLowerCase() }) // matched case-insensitively
        .expect(201);

      expect(res.body.promo.code).toBe(PERCENT_CODE);
      expect(Number(res.body.discountKes)).toBe(1000); // 10% of 10,000
      // Taxable base 9,000 * 16% = 1,440. Total = 9,000 + 1,440 = 10,440.
      expect(Number(res.body.vatKes)).toBe(1440);
      expect(Number(res.body.totalKes)).toBe(10440);
    });

    it('applies a fixed discount clamped to the subtotal', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/cart/apply-promo')
        .set(auth(token))
        .send({ code: FIXED_CODE })
        .expect(201);

      expect(Number(res.body.discountKes)).toBe(500);
      // Taxable base 9,500 * 16% = 1,520. Total = 9,500 + 1,520 = 11,020.
      expect(Number(res.body.vatKes)).toBe(1520);
      expect(Number(res.body.totalKes)).toBe(11020);
    });

    it('clears an applied promo', async () => {
      await request(app.getHttpServer())
        .post('/api/cart/apply-promo')
        .set(auth(token))
        .send({ code: FIXED_CODE })
        .expect(201);

      const res = await request(app.getHttpServer())
        .delete('/api/cart/promo')
        .set(auth(token))
        .expect(200);

      expect(res.body.promo).toBeNull();
      expect(Number(res.body.discountKes)).toBe(0);
      expect(Number(res.body.totalKes)).toBe(11600); // back to no-discount total
    });
  });
});
