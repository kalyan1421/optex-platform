import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Wishlist — `GET /wishlist`, `POST/DELETE /wishlist/:productId`.
 *
 * The guarantees that matter most (SPEC-10): saving an already-saved
 * product is a no-op, not a conflict — including the same-product-from-
 * two-tabs race the spec's own edge cases call out; a customer can never
 * read another customer's wishlist; and a since-discontinued product
 * still lists correctly (marked unavailable), never a broken row.
 */
describe('Wishlist (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let token: string;
  let otherToken: string;
  let categoryId: string;
  let productId: string;
  let discontinuedProductId: string;
  const userIds: string[] = [];

  const PASSWORD = 'TestPassword123!';
  const CATEGORY_SLUG = 'e2e-wishlist-category';
  const PRODUCT_SKU = 'E2E-WISHLIST-PRODUCT';
  const DISCONTINUED_SKU = 'E2E-WISHLIST-DISCONTINUED';

  /**
   * Capturing `id` (not just `email`) is what lets `afterAll` delete the
   * `auth.users` row directly — `customers.auth_user_id` cascades, so a
   * customer row deleted only by email lookup was leaving the auth user
   * itself behind on every run.
   */
  async function newAccount(): Promise<{ token: string; email: string; id: string }> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `wishlist-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);
    return { token: data.session!.access_token, email, id: data.user!.id };
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
      .insert({ slug: CATEGORY_SLUG, name: 'E2E Wishlist Category' })
      .select('id')
      .single();
    if (catError) throw catError;
    categoryId = category!.id;

    await db.from('products').delete().in('sku', [PRODUCT_SKU, DISCONTINUED_SKU]);
    const { data: product, error: prodError } = await db
      .from('products')
      .insert({
        sku: PRODUCT_SKU,
        slug: 'e2e-wishlist-product',
        name: 'E2E Wishlist Product',
        category_id: categoryId,
        price_kes: 7500,
        brand: 'Optex',
        images: ['/seed/e2e-wishlist.png'],
        is_active: true,
      })
      .select('id')
      .single();
    if (prodError) throw prodError;
    productId = product!.id;

    const { data: discontinued, error: discError } = await db
      .from('products')
      .insert({
        sku: DISCONTINUED_SKU,
        slug: 'e2e-wishlist-discontinued',
        name: 'E2E Wishlist Discontinued Product',
        category_id: categoryId,
        price_kes: 4200,
        is_active: false,
      })
      .select('id')
      .single();
    if (discError) throw discError;
    discontinuedProductId = discontinued!.id;
  });

  afterAll(async () => {
    // wishlist_items.product_id/customer_id both cascade (migration 0017),
    // so deleting the products and auth users is enough — no separate
    // wishlist_items cleanup needed.
    await db.from('products').delete().in('sku', [PRODUCT_SKU, DISCONTINUED_SKU]);
    await db.from('categories').delete().eq('slug', CATEGORY_SLUG);
    for (const id of userIds) {
      await db.auth.admin.deleteUser(id);
    }
    await app.close();
  });

  it('requires authentication for every route', async () => {
    await request(app.getHttpServer()).get('/api/wishlist').expect(401);
    await request(app.getHttpServer()).post(`/api/wishlist/${productId}`).expect(401);
    await request(app.getHttpServer()).delete(`/api/wishlist/${productId}`).expect(401);
  });

  it('saves a product and lists it back with product data', async () => {
    await request(app.getHttpServer())
      .post(`/api/wishlist/${productId}`)
      .set(auth(token))
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/wishlist')
      .set(auth(token))
      .expect(200);

    const entry = list.body.find((i: { productId: string }) => i.productId === productId);
    expect(entry).toBeDefined();
    expect(entry.product.name).toBe('E2E Wishlist Product');
    expect(Number(entry.product.priceKes)).toBe(7500);
    expect(entry.product.isActive).toBe(true);
  });

  it('saving an already-saved product is idempotent, not a conflict', async () => {
    await request(app.getHttpServer())
      .post(`/api/wishlist/${productId}`)
      .set(auth(token))
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/wishlist')
      .set(auth(token))
      .expect(200);
    const matches = list.body.filter((i: { productId: string }) => i.productId === productId);
    expect(matches).toHaveLength(1);
  });

  it('two concurrent saves of the same product converge on exactly one row', async () => {
    const racer = await newAccount();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer()).post(`/api/wishlist/${productId}`).set(auth(racer.token)),
      ),
    );
    for (const r of results) expect(r.status).toBe(201);

    const list = await request(app.getHttpServer())
      .get('/api/wishlist')
      .set(auth(racer.token))
      .expect(200);
    const matches = list.body.filter((i: { productId: string }) => i.productId === productId);
    expect(matches).toHaveLength(1);
  });

  it('does not expose another customer’s wishlist', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/wishlist')
      .set(auth(otherToken))
      .expect(200);
    expect(list.body).toHaveLength(0);
  });

  it('404s saving a nonexistent product', async () => {
    await request(app.getHttpServer())
      .post('/api/wishlist/00000000-0000-0000-0000-000000000000')
      .set(auth(token))
      .expect(404);
  });

  it('lists a discontinued product as unavailable rather than omitting or erroring', async () => {
    await request(app.getHttpServer())
      .post(`/api/wishlist/${discontinuedProductId}`)
      .set(auth(token))
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/wishlist')
      .set(auth(token))
      .expect(200);

    const entry = list.body.find(
      (i: { productId: string }) => i.productId === discontinuedProductId,
    );
    expect(entry).toBeDefined();
    expect(entry.product.isActive).toBe(false);
  });

  it('removes a product, and removing it again is a harmless no-op', async () => {
    await request(app.getHttpServer())
      .delete(`/api/wishlist/${productId}`)
      .set(auth(token))
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/wishlist')
      .set(auth(token))
      .expect(200);
    expect(list.body.find((i: { productId: string }) => i.productId === productId)).toBeUndefined();

    // Idempotent: removing an already-absent product must not error.
    await request(app.getHttpServer())
      .delete(`/api/wishlist/${productId}`)
      .set(auth(token))
      .expect(200);
  });
});
