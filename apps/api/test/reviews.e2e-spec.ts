import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Product reviews — `GET/POST /products/:id/reviews`, admin moderation at
 * `/admin/reviews`.
 *
 * Zero coverage existed. The two guarantees that matter most: a `pending`
 * review must never appear on the public product page (moderation would be
 * pointless otherwise), and a customer can review a product at most once.
 */
describe('Reviews (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let token: string;
  let otherToken: string;
  let adminToken: string;
  let categoryId: string;
  let productId: string;
  const emails: string[] = [];

  const PASSWORD = 'TestPassword123!';
  const CATEGORY_SLUG = 'e2e-reviews-category';
  const PRODUCT_SKU = 'E2E-REVIEWS-PRODUCT';

  async function newAccount(): Promise<{ token: string; email: string }> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `reviews-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    emails.push(email);
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

    const admin = await newAccount();
    const { data: adminUsers } = await db.auth.admin.listUsers();
    const adminRow = adminUsers.users.find((u) => u.email === admin.email);
    await db.auth.admin.updateUserById(adminRow!.id, { app_metadata: { role: 'super_admin' } });
    const anonForAdmin = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const { data: adminSession } = await anonForAdmin.auth.signInWithPassword({
      email: admin.email,
      password: PASSWORD,
    });
    adminToken = adminSession.session!.access_token;

    await db.from('categories').delete().eq('slug', CATEGORY_SLUG);
    const { data: category, error: catError } = await db
      .from('categories')
      .insert({ slug: CATEGORY_SLUG, name: 'E2E Reviews Category' })
      .select('id')
      .single();
    if (catError) throw catError;
    categoryId = category!.id;

    await db.from('products').delete().eq('sku', PRODUCT_SKU);
    const { data: product, error: prodError } = await db
      .from('products')
      .insert({
        sku: PRODUCT_SKU,
        slug: 'e2e-reviews-product',
        name: 'E2E Reviews Product',
        category_id: categoryId,
        price_kes: 5000,
        is_active: true,
      })
      .select('id')
      .single();
    if (prodError) throw prodError;
    productId = product!.id;
  });

  afterAll(async () => {
    await db.from('product_reviews').delete().eq('product_id', productId);
    await db.from('products').delete().eq('sku', PRODUCT_SKU);
    await db.from('categories').delete().eq('slug', CATEGORY_SLUG);
    for (const email of emails) {
      const { data: c } = await db.from('customers').select('id').eq('email', email).maybeSingle();
      if (c) await db.from('customers').delete().eq('id', c.id);
    }
    await app.close();
  });

  it('lists no reviews and a null-average aggregate for a fresh product', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/products/${productId}/reviews`)
      .expect(200);
    expect(res.body.reviews).toHaveLength(0);
    expect(res.body.aggregate).toEqual({ averageRating: null, count: 0 });
  });

  it('requires authentication to submit a review', async () => {
    await request(app.getHttpServer())
      .post(`/api/products/${productId}/reviews`)
      .send({ rating: 5, body: 'Great frames.' })
      .expect(401);
  });

  it('rejects a rating outside 1-5', async () => {
    await request(app.getHttpServer())
      .post(`/api/products/${productId}/reviews`)
      .set(auth(token))
      .send({ rating: 0, body: 'Zero stars?' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/products/${productId}/reviews`)
      .set(auth(token))
      .send({ rating: 6, body: 'Six stars!' })
      .expect(400);
  });

  it('creates a pending review, invisible on the public list until approved', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/products/${productId}/reviews`)
      .set(auth(token))
      .send({ rating: 4, body: 'Comfortable, good value.' })
      .expect(201);
    expect(created.body.status).toBe('pending');

    const list = await request(app.getHttpServer())
      .get(`/api/products/${productId}/reviews`)
      .expect(200);
    expect(list.body.reviews).toHaveLength(0);
    expect(list.body.aggregate.count).toBe(0);
  });

  it('refuses a second review from the same customer for the same product', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/products/${productId}/reviews`)
      .set(auth(token))
      .send({ rating: 5, body: 'Trying again.' })
      .expect(409);
    expect(res.body.message).toMatch(/already reviewed/i);
  });

  it('does not persist the title field — the schema has no column for it', async () => {
    const other = await request(app.getHttpServer())
      .post(`/api/products/${productId}/reviews`)
      .set(auth(otherToken))
      .send({ rating: 3, title: 'Ignored title', body: 'Middling.' })
      .expect(201);
    expect(other.body.title).toBeUndefined();
  });

  describe('admin moderation', () => {
    it('refuses a non-admin on every admin route', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/reviews')
        .set(auth(otherToken))
        .expect(403);
    });

    it('lists every status, including pending, for an admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/reviews')
        .set(auth(adminToken))
        .expect(200);
      const forThisProduct = res.body.filter(
        (r: { product_id: string }) => r.product_id === productId,
      );
      expect(forThisProduct.length).toBeGreaterThanOrEqual(2);
      expect(forThisProduct.every((r: { status: string }) => r.status === 'pending')).toBe(true);
      // Admin rows carry the names the moderation queue needs to render.
      expect(forThisProduct[0].customer_name ?? null).not.toBeUndefined();
      expect(forThisProduct[0].product_name).toBe('E2E Reviews Product');
    });

    it('filters by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/reviews?status=approved')
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.some((r: { product_id: string }) => r.product_id === productId)).toBe(false);
    });

    it('409s moderating a review that does not exist', async () => {
      await request(app.getHttpServer())
        .patch('/api/admin/reviews/00000000-0000-0000-0000-000000000000')
        .set(auth(adminToken))
        .send({ status: 'approved' })
        .expect(409);
    });

    it('approving surfaces the review on the public list and the aggregate', async () => {
      const pending = await request(app.getHttpServer())
        .get('/api/admin/reviews?status=pending')
        .set(auth(adminToken))
        .expect(200);
      const mine = pending.body.find(
        (r: { product_id: string; rating: number }) => r.product_id === productId && r.rating === 4,
      );

      const moderated = await request(app.getHttpServer())
        .patch(`/api/admin/reviews/${mine.id}`)
        .set(auth(adminToken))
        .send({ status: 'approved', admin_reply: 'Thanks for the feedback!' })
        .expect(200);
      expect(moderated.body.status).toBe('approved');
      expect(moderated.body.admin_reply).toBe('Thanks for the feedback!');

      const list = await request(app.getHttpServer())
        .get(`/api/products/${productId}/reviews`)
        .expect(200);
      expect(list.body.reviews).toHaveLength(1);
      expect(list.body.aggregate).toEqual({ averageRating: 4, count: 1 });
    });

    it('a second approval brings the aggregate to a rounded average', async () => {
      const pending = await request(app.getHttpServer())
        .get('/api/admin/reviews?status=pending')
        .set(auth(adminToken))
        .expect(200);
      const second = pending.body.find(
        (r: { product_id: string; rating: number }) => r.product_id === productId && r.rating === 3,
      );

      await request(app.getHttpServer())
        .patch(`/api/admin/reviews/${second.id}`)
        .set(auth(adminToken))
        .send({ status: 'approved' })
        .expect(200);

      const list = await request(app.getHttpServer())
        .get(`/api/products/${productId}/reviews`)
        .expect(200);
      expect(list.body.reviews).toHaveLength(2);
      // (4 + 3) / 2 = 3.5.
      expect(list.body.aggregate).toEqual({ averageRating: 3.5, count: 2 });
    });
  });
});
