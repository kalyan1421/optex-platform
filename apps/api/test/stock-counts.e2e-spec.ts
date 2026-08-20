import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Physical stock counts — CR-01 R2 sub-phase 2d.
 *
 * `accept_stock_count` (migration 0029) reconciles three distinct outcomes:
 * expected-but-missing (write-off), found-but-mistracked (relocation, the
 * system's own record was wrong), and found-and-never-seen-before (SPEC-08's
 * own edge case — a genuinely new serial). Each gets its own test.
 */
describe('Physical stock counts (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let categoryId: string;
  let branchA: string;
  let branchB: string;
  const userIds: string[] = [];
  const productIds: string[] = [];

  const PASSWORD = 'TestPassword123!';
  const CATEGORY_SLUG = 'e2e-stock-counts-category';

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function newStaffAccount(roleId: string): Promise<string> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `stock-counts-e2e-${Date.now()}-${Math.floor(Math.random() * 100000)}@optex-test.local`;
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

  async function newProduct(name: string): Promise<string> {
    const { data, error } = await db
      .from('products')
      .insert({
        slug: `e2e-stock-counts-${name}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        sku: `E2E-CNT-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
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
    return data.id;
  }

  /** Inserts a serial row. Caller is responsible for setting `inventory.stock` to match — same fixture convention as the other R2 e2e specs. */
  async function newSerial(productId: string, branchId: string | null, status = 'in_stock'): Promise<{ id: string; serial_number: string }> {
    const serial_number = `E2E-CNT-SERIAL-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}-${serialCounter++}`;
    const { data, error } = await db
      .from('product_serials')
      .insert({ product_id: productId, serial_number, status, current_branch_id: branchId })
      .select('id, serial_number')
      .single();
    if (error) throw error;
    return data as { id: string; serial_number: string };
  }

  async function stockAt(productId: string, branchId: string): Promise<number> {
    const { data } = await db.from('inventory').select('stock').eq('product_id', productId).eq('branch_id', branchId).maybeSingle();
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
      .upsert({ slug: CATEGORY_SLUG, name: 'E2E Stock Counts' }, { onConflict: 'slug' })
      .select('id')
      .single<{ id: string }>();
    categoryId = cat!.id;

    const { data: branches } = await db.from('branches').select('id').eq('is_active', true).limit(2);
    branchA = branches![0].id;
    branchB = branches![1].id;
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

  it('a Branch Manager cannot start a count — R2 gave them no inventory write surface', async () => {
    const token = await newStaffAccount('branch_manager');
    await request(app.getHttpServer())
      .post('/api/admin/stock-counts')
      .set(auth(token))
      .send({ branch_id: branchA })
      .expect(403);
  });

  it('starting a count snapshots every serial the system believes is in stock at that branch', async () => {
    const productId = await newProduct('snapshot');
    await db.from('inventory').update({ stock: 2 }).eq('product_id', productId).eq('branch_id', branchA);
    const s1 = await newSerial(productId, branchA);
    const s2 = await newSerial(productId, branchA);

    const token = await newStaffAccount('inventory_manager');
    const res = await request(app.getHttpServer())
      .post('/api/admin/stock-counts')
      .set(auth(token))
      .send({ branch_id: branchA })
      .expect(201);

    expect(res.body.status).toBe('in_progress');
    const serialIds = res.body.items.map((i: { serial_id: string }) => i.serial_id);
    expect(serialIds).toEqual(expect.arrayContaining([s1.id, s2.id]));
    expect(res.body.items.every((i: { expected: boolean; found: boolean }) => i.expected && !i.found)).toBe(true);
  });

  it('accepting writes off an expected serial that was never scanned', async () => {
    const productId = await newProduct('missing');
    await db.from('inventory').update({ stock: 1 }).eq('product_id', productId).eq('branch_id', branchA);
    const serial = await newSerial(productId, branchA);

    const token = await newStaffAccount('inventory_manager');
    const startRes = await request(app.getHttpServer())
      .post('/api/admin/stock-counts')
      .set(auth(token))
      .send({ branch_id: branchA })
      .expect(201);
    const countId = startRes.body.id;

    // No scans at all — the serial is never confirmed found.
    const acceptRes = await request(app.getHttpServer())
      .post(`/api/admin/stock-counts/${countId}/accept`)
      .set(auth(token))
      .expect(201);

    expect(acceptRes.body.status).toBe('completed');
    expect(await stockAt(productId, branchA)).toBe(0);

    const { data: after } = await db.from('product_serials').select('status').eq('id', serial.id).single();
    expect((after as { status: string }).status).toBe('written_off');

    const { data: adjItem } = await db
      .from('stock_adjustment_items')
      .select('reason_code, direction')
      .eq('serial_id', serial.id)
      .single();
    expect((adjItem as { reason_code: string }).reason_code).toBe('count_correction');
    expect((adjItem as { direction: string }).direction).toBe('remove');
  });

  it('scanning a serial the system thinks is at a different branch relocates it (count_variance)', async () => {
    const productId = await newProduct('relocated');
    await db.from('inventory').update({ stock: 1 }).eq('product_id', productId).eq('branch_id', branchA);
    const serial = await newSerial(productId, branchA); // system thinks it's at branch A

    const token = await newStaffAccount('inventory_manager');
    // Count branch B — this serial is not expected there at all.
    const startRes = await request(app.getHttpServer())
      .post('/api/admin/stock-counts')
      .set(auth(token))
      .send({ branch_id: branchB })
      .expect(201);
    const countId = startRes.body.id;

    await request(app.getHttpServer())
      .patch(`/api/admin/stock-counts/${countId}/scan`)
      .set(auth(token))
      .send({ scans: [{ serial_number: serial.serial_number }] })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/admin/stock-counts/${countId}/accept`)
      .set(auth(token))
      .expect(201);

    expect(await stockAt(productId, branchA)).toBe(0);
    expect(await stockAt(productId, branchB)).toBe(1);

    const { data: after } = await db.from('product_serials').select('status, current_branch_id').eq('id', serial.id).single();
    expect((after as { status: string }).status).toBe('in_stock');
    expect((after as { current_branch_id: string }).current_branch_id).toBe(branchB);

    const { data: ledger } = await db
      .from('stock_ledger')
      .select('movement_type, from_branch_id, to_branch_id')
      .eq('serial_id', serial.id)
      .eq('movement_type', 'count_variance')
      .single();
    expect((ledger as { from_branch_id: string }).from_branch_id).toBe(branchA);
    expect((ledger as { to_branch_id: string }).to_branch_id).toBe(branchB);
  });

  it('scanning a genuinely unrecognized serial requires a product before accepting, then creates it with no cost', async () => {
    const productId = await newProduct('never-seen');
    const token = await newStaffAccount('inventory_manager');

    const startRes = await request(app.getHttpServer())
      .post('/api/admin/stock-counts')
      .set(auth(token))
      .send({ branch_id: branchA })
      .expect(201);
    const countId = startRes.body.id;

    const unknownSerialNumber = `E2E-CNT-UNKNOWN-${Date.now()}`;

    // Scan without a product — accept must refuse.
    await request(app.getHttpServer())
      .patch(`/api/admin/stock-counts/${countId}/scan`)
      .set(auth(token))
      .send({ scans: [{ serial_number: unknownSerialNumber }] })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/admin/stock-counts/${countId}/accept`)
      .set(auth(token))
      .expect(400);

    // Re-scanning the same serial with a product resolves it.
    await request(app.getHttpServer())
      .patch(`/api/admin/stock-counts/${countId}/scan`)
      .set(auth(token))
      .send({ scans: [{ serial_number: unknownSerialNumber, product_id: productId }] })
      .expect(200);

    const acceptRes = await request(app.getHttpServer())
      .post(`/api/admin/stock-counts/${countId}/accept`)
      .set(auth(token))
      .expect(201);
    expect(acceptRes.body.status).toBe('completed');
    expect(await stockAt(productId, branchA)).toBe(1);

    const { data: created } = await db
      .from('product_serials')
      .select('cost_price_kes, status, current_branch_id')
      .eq('serial_number', unknownSerialNumber)
      .single();
    expect((created as { cost_price_kes: number | null }).cost_price_kes).toBeNull();
    expect((created as { status: string }).status).toBe('in_stock');
    expect((created as { current_branch_id: string }).current_branch_id).toBe(branchA);
  });

  it('cannot accept the same count twice', async () => {
    const productId = await newProduct('double-accept');
    const token = await newStaffAccount('inventory_manager');
    const startRes = await request(app.getHttpServer())
      .post('/api/admin/stock-counts')
      .set(auth(token))
      .send({ branch_id: branchA })
      .expect(201);
    const countId = startRes.body.id;
    void productId;

    await request(app.getHttpServer()).post(`/api/admin/stock-counts/${countId}/accept`).set(auth(token)).expect(201);
    await request(app.getHttpServer()).post(`/api/admin/stock-counts/${countId}/accept`).set(auth(token)).expect(409);
  });
});
