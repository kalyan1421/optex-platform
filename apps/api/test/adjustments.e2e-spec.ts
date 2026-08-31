import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Stock adjustments — CR-01 R2 sub-phase 2c.
 *
 * `post_adjustment` (migration 0028) is the only write path into
 * `stock_adjustment_items`. This proves the two directions each work end to
 * end — writing off a specific in-stock serial, and logging stock the system
 * had no record of — and that a physical walk can mix both in one call.
 */
describe('Stock adjustments (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let categoryId: string;
  let branchId: string;
  const userIds: string[] = [];
  const productIds: string[] = [];

  const PASSWORD = 'TestPassword123!';
  const CATEGORY_SLUG = 'e2e-adjustments-category';

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function newStaffAccount(roleId: string): Promise<string> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `adjustments-e2e-${Date.now()}-${Math.floor(Math.random() * 100000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);

    await db.auth.admin.updateUserById(data.user!.id, { app_metadata: { role: roleId } });

    const { data: session, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (signInError) throw signInError;
    return session.session!.access_token;
  }

  let serialCounter = 0;

  async function newProductWithSerials(
    name: string,
    count: number,
  ): Promise<{ productId: string; serialIds: string[] }> {
    const { data, error } = await db
      .from('products')
      .insert({
        slug: `e2e-adjustments-${name}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        sku: `E2E-ADJ-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        name,
        category_id: categoryId,
        price_kes: 5000,
        is_active: true,
      })
      .select('id')
      .single<{ id: string }>();
    if (error) throw error;
    productIds.push(data.id);

    await db.from('inventory').update({ stock: 0 }).eq('product_id', data.id);

    let serialIds: string[] = [];
    if (count > 0) {
      const serials = Array.from({ length: count }, () => ({
        product_id: data.id,
        serial_number: `E2E-ADJ-SERIAL-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}-${serialCounter++}`,
        status: 'in_stock',
        current_branch_id: branchId,
      }));
      const { data: inserted, error: serialError } = await db
        .from('product_serials')
        .insert(serials)
        .select('id');
      if (serialError) throw serialError;
      serialIds = (inserted ?? []).map((r) => (r as { id: string }).id);
      await db
        .from('inventory')
        .update({ stock: count })
        .eq('product_id', data.id)
        .eq('branch_id', branchId);
    }

    return { productId: data.id, serialIds };
  }

  async function stockOf(productId: string): Promise<number> {
    const { data } = await db
      .from('inventory')
      .select('stock')
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .single();
    return (data as { stock: number } | null)?.stock ?? 0;
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
      .upsert({ slug: CATEGORY_SLUG, name: 'E2E Adjustments' }, { onConflict: 'slug' })
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
  });

  afterEach(async () => {
    if (productIds.length) {
      await db.from('products').update({ is_active: false }).in('id', productIds);
      productIds.length = 0;
    }
  });

  afterAll(async () => {
    for (const id of userIds) await db.auth.admin.deleteUser(id);
    await db.from('categories').delete().eq('slug', CATEGORY_SLUG);
    await app.close();
  });

  it('a Branch Manager cannot post an adjustment — R2 gave them no inventory write surface', async () => {
    const { serialIds } = await newProductWithSerials('no-access', 1);
    const token = await newStaffAccount('branch_manager');

    await request(app.getHttpServer())
      .post('/api/admin/adjustments')
      .set(auth(token))
      .send({
        branch_id: branchId,
        items: [{ direction: 'remove', serial_id: serialIds[0], reason_code: 'damage' }],
      })
      .expect(403);
  });

  it('writes off a specific in-stock serial for a stated reason', async () => {
    const { productId, serialIds } = await newProductWithSerials('write-off', 2);
    const token = await newStaffAccount('inventory_manager');

    const res = await request(app.getHttpServer())
      .post('/api/admin/adjustments')
      .set(auth(token))
      .send({
        branch_id: branchId,
        items: [{ direction: 'remove', serial_id: serialIds[0], reason_code: 'damage' }],
      })
      .expect(201);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].direction).toBe('remove');
    expect(res.body.items[0].reason_code).toBe('damage');
    expect(await stockOf(productId)).toBe(1);

    const { data: serial } = await db
      .from('product_serials')
      .select('status, current_branch_id')
      .eq('id', serialIds[0])
      .single();
    expect((serial as { status: string }).status).toBe('written_off');
    expect((serial as { current_branch_id: string | null }).current_branch_id).toBeNull();
  });

  it('logs newly-found stock as a new serial with no cost, distinct from a GRN receipt', async () => {
    const { productId } = await newProductWithSerials('found', 0);
    const token = await newStaffAccount('inventory_manager');

    const res = await request(app.getHttpServer())
      .post('/api/admin/adjustments')
      .set(auth(token))
      .send({
        branch_id: branchId,
        items: [{ direction: 'add', product_id: productId, reason_code: 'found' }],
      })
      .expect(201);

    expect(res.body.items[0].direction).toBe('add');
    expect(await stockOf(productId)).toBe(1);

    const { data: ledgerRow } = await db
      .from('stock_ledger')
      .select('movement_type, serial:product_serials(cost_price_kes)')
      .eq('reference_type', 'adjustment')
      .eq('reference_id', res.body.id)
      .single();
    expect((ledgerRow as { movement_type: string }).movement_type).toBe('found');
    const serial = (
      ledgerRow as {
        serial: { cost_price_kes: number | null } | { cost_price_kes: number | null }[];
      }
    ).serial;
    const cost = Array.isArray(serial) ? serial[0]?.cost_price_kes : serial?.cost_price_kes;
    expect(cost).toBeNull();
  });

  it('mixes a write-off and a found line in one adjustment, one physical walk', async () => {
    const { productId, serialIds } = await newProductWithSerials('mixed', 1);
    const token = await newStaffAccount('inventory_manager');

    const res = await request(app.getHttpServer())
      .post('/api/admin/adjustments')
      .set(auth(token))
      .send({
        branch_id: branchId,
        items: [
          { direction: 'remove', serial_id: serialIds[0], reason_code: 'count_correction' },
          { direction: 'add', product_id: productId, reason_code: 'found' },
        ],
      })
      .expect(201);

    expect(res.body.items).toHaveLength(2);
    // Net zero: one written off, one found.
    expect(await stockOf(productId)).toBe(1);
  });

  it("rejects reason_code 'found' on a remove line", async () => {
    const { serialIds } = await newProductWithSerials('bad-reason', 1);
    const token = await newStaffAccount('inventory_manager');

    await request(app.getHttpServer())
      .post('/api/admin/adjustments')
      .set(auth(token))
      .send({
        branch_id: branchId,
        items: [{ direction: 'remove', serial_id: serialIds[0], reason_code: 'found' }],
      })
      .expect(400);
  });

  it("rejects a removal-only reason on an 'add' line in the database mutation", async () => {
    const { productId } = await newProductWithSerials('bad-add-reason', 0);
    const token = await newStaffAccount('inventory_manager');

    await request(app.getHttpServer())
      .post('/api/admin/adjustments')
      .set(auth(token))
      .send({
        branch_id: branchId,
        items: [{ direction: 'add', product_id: productId, reason_code: 'damage' }],
      })
      .expect(400);

    expect(await stockOf(productId)).toBe(0);
  });

  it('refuses to write off a serial that is not currently in stock at that branch', async () => {
    const { serialIds } = await newProductWithSerials('already-sold', 1);
    const token = await newStaffAccount('inventory_manager');

    await db
      .from('product_serials')
      .update({ status: 'sold', current_branch_id: null })
      .eq('id', serialIds[0]);

    await request(app.getHttpServer())
      .post('/api/admin/adjustments')
      .set(auth(token))
      .send({
        branch_id: branchId,
        items: [{ direction: 'remove', serial_id: serialIds[0], reason_code: 'damage' }],
      })
      .expect(400);
  });

  it('lists seeded reason codes', async () => {
    const token = await newStaffAccount('inventory_manager');
    const res = await request(app.getHttpServer())
      .get('/api/admin/adjustments/reasons')
      .set(auth(token))
      .expect(200);
    expect(res.body.map((r: { id: string }) => r.id)).toEqual(
      expect.arrayContaining(['damage', 'loss_theft', 'found', 'count_correction']),
    );
  });
});
