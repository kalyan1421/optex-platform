import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Inter-branch transfers — CR-01 R2 sub-phase 2b.
 *
 * `dispatch_transfer`/`receive_transfer` (migration 0027) are the only write
 * path into `stock_transfer_items`. This file proves the two things SPEC-08
 * calls out explicitly: a transfer can be received in more than one call
 * (partial receipt), and a line marked lost becomes a real, reason-coded
 * write-off rather than a silent status flip.
 */
describe('Inter-branch transfers (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let categoryId: string;
  let branchA: string;
  let branchB: string;
  const userIds: string[] = [];
  const productIds: string[] = [];

  const PASSWORD = 'TestPassword123!';
  const CATEGORY_SLUG = 'e2e-transfers-category';

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function newStaffAccount(roleId: string): Promise<string> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `transfers-e2e-${Date.now()}-${Math.floor(Math.random() * 100000)}@optex-test.local`;
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

  /** Creates a product with `count` in_stock serials at branchA. Returns [productId, serialIds]. */
  async function newProductWithSerials(
    name: string,
    count: number,
  ): Promise<{ productId: string; serialIds: string[] }> {
    const { data, error } = await db
      .from('products')
      .insert({
        slug: `e2e-transfers-${name}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        sku: `E2E-TRF-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
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

    const serials = Array.from({ length: count }, () => ({
      product_id: data.id,
      serial_number: `E2E-TRF-SERIAL-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}-${serialCounter++}`,
      status: 'in_stock',
      current_branch_id: branchA,
    }));
    const { data: inserted, error: serialError } = await db
      .from('product_serials')
      .insert(serials)
      .select('id');
    if (serialError) throw serialError;

    await db
      .from('inventory')
      .update({ stock: count })
      .eq('product_id', data.id)
      .eq('branch_id', branchA);

    return { productId: data.id, serialIds: (inserted ?? []).map((r) => (r as { id: string }).id) };
  }

  async function stockAt(productId: string, branchId: string): Promise<number> {
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
      .upsert({ slug: CATEGORY_SLUG, name: 'E2E Transfers' }, { onConflict: 'slug' })
      .select('id')
      .single<{ id: string }>();
    categoryId = cat!.id;

    const { data: branches } = await db
      .from('branches')
      .select('id')
      .eq('is_active', true)
      .limit(2);
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

  it('a Branch Manager cannot dispatch a transfer — R2 gave them no inventory write surface', async () => {
    const { productId, serialIds } = await newProductWithSerials('no-access', 1);
    const token = await newStaffAccount('branch_manager');

    await request(app.getHttpServer())
      .post('/api/admin/transfers')
      .set(auth(token))
      .send({ from_branch_id: branchA, to_branch_id: branchB, serial_ids: serialIds })
      .expect(403);

    expect(await stockAt(productId, branchA)).toBe(1);
  });

  it('dispatching moves serials out of the origin branch and into transit, not yet the destination', async () => {
    const { productId, serialIds } = await newProductWithSerials('dispatch', 3);
    const token = await newStaffAccount('inventory_manager');

    const res = await request(app.getHttpServer())
      .post('/api/admin/transfers')
      .set(auth(token))
      .send({
        from_branch_id: branchA,
        to_branch_id: branchB,
        serial_ids: serialIds,
        notes: 'e2e dispatch',
      })
      .expect(201);

    expect(res.body.status).toBe('in_transit');
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items.every((i: { status: string }) => i.status === 'in_transit')).toBe(true);

    expect(await stockAt(productId, branchA)).toBe(0);
    expect(await stockAt(productId, branchB)).toBe(0);

    const { data: serials } = await db
      .from('product_serials')
      .select('status, current_branch_id')
      .in('id', serialIds);
    for (const s of serials ?? []) {
      expect((s as { status: string }).status).toBe('in_transit');
      expect((s as { current_branch_id: string | null }).current_branch_id).toBeNull();
    }
  });

  it('refuses to dispatch a serial that is not in stock at the origin branch', async () => {
    const { serialIds } = await newProductWithSerials('wrong-origin', 1);
    const token = await newStaffAccount('inventory_manager');

    await request(app.getHttpServer())
      .post('/api/admin/transfers')
      .set(auth(token))
      .send({ from_branch_id: branchB, to_branch_id: branchA, serial_ids: serialIds })
      .expect(400);
  });

  it('supports a genuine partial receipt across two calls, and marks a lost line as a reasoned write-off', async () => {
    const { productId, serialIds } = await newProductWithSerials('partial-receipt', 3);
    const token = await newStaffAccount('inventory_manager');

    const dispatchRes = await request(app.getHttpServer())
      .post('/api/admin/transfers')
      .set(auth(token))
      .send({ from_branch_id: branchA, to_branch_id: branchB, serial_ids: serialIds })
      .expect(201);
    const transferId: string = dispatchRes.body.id;
    const [serialA, serialB, serialC] = serialIds;

    // First call: one arrives, one is lost. Third is left untouched.
    const firstReceive = await request(app.getHttpServer())
      .patch(`/api/admin/transfers/${transferId}/receive`)
      .set(auth(token))
      .send({ received: [serialA], lost: [{ serial_id: serialB, reason_code: 'loss_theft' }] })
      .expect(200);

    expect(firstReceive.body.status).toBe('in_transit'); // serialC still unresolved
    expect(await stockAt(productId, branchB)).toBe(1);

    const { data: afterFirst } = await db
      .from('product_serials')
      .select('id, status, current_branch_id')
      .in('id', [serialA, serialB]);
    const byId = new Map((afterFirst ?? []).map((r) => [(r as { id: string }).id, r]));
    expect((byId.get(serialA) as { status: string }).status).toBe('in_stock');
    expect((byId.get(serialA) as { current_branch_id: string }).current_branch_id).toBe(branchB);
    expect((byId.get(serialB) as { status: string }).status).toBe('written_off');

    const { data: adjustmentItem } = await db
      .from('stock_adjustment_items')
      .select('reason_code, direction, adjustment:stock_adjustments(branch_id)')
      .eq('serial_id', serialB)
      .single();
    expect((adjustmentItem as { reason_code: string }).reason_code).toBe('loss_theft');
    expect((adjustmentItem as { direction: string }).direction).toBe('remove');

    // Second call resolves the remaining line — header should now close out.
    const secondReceive = await request(app.getHttpServer())
      .patch(`/api/admin/transfers/${transferId}/receive`)
      .set(auth(token))
      .send({ received: [serialC] })
      .expect(200);

    expect(secondReceive.body.status).toBe('received');
    expect(await stockAt(productId, branchB)).toBe(2); // serialA + serialC; serialB was written off
    expect(await stockAt(productId, branchA)).toBe(0);
  });

  it('rejects an ambiguous receipt that marks the same serial as both received and lost', async () => {
    const { productId, serialIds } = await newProductWithSerials('ambiguous-receipt', 1);
    const token = await newStaffAccount('inventory_manager');

    const dispatchRes = await request(app.getHttpServer())
      .post('/api/admin/transfers')
      .set(auth(token))
      .send({ from_branch_id: branchA, to_branch_id: branchB, serial_ids: serialIds })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/admin/transfers/${dispatchRes.body.id}/receive`)
      .set(auth(token))
      .send({ received: serialIds, lost: [{ serial_id: serialIds[0], reason_code: 'loss_theft' }] })
      .expect(400);

    expect(await stockAt(productId, branchA)).toBe(0);
    expect(await stockAt(productId, branchB)).toBe(0);
    const { data: serial } = await db
      .from('product_serials')
      .select('status')
      .eq('id', serialIds[0])
      .single();
    expect((serial as { status: string }).status).toBe('in_transit');
  });

  it('re-receiving an already-resolved serial is a no-op, not a double credit', async () => {
    const { productId, serialIds } = await newProductWithSerials('idempotent-receive', 1);
    const token = await newStaffAccount('inventory_manager');

    const dispatchRes = await request(app.getHttpServer())
      .post('/api/admin/transfers')
      .set(auth(token))
      .send({ from_branch_id: branchA, to_branch_id: branchB, serial_ids: serialIds })
      .expect(201);
    const transferId: string = dispatchRes.body.id;

    await request(app.getHttpServer())
      .patch(`/api/admin/transfers/${transferId}/receive`)
      .set(auth(token))
      .send({ received: serialIds })
      .expect(200);
    expect(await stockAt(productId, branchB)).toBe(1);

    // The transfer is already 'received' — the service refuses another call
    // outright rather than relying solely on the RPC's per-line guard.
    await request(app.getHttpServer())
      .patch(`/api/admin/transfers/${transferId}/receive`)
      .set(auth(token))
      .send({ received: serialIds })
      .expect(400);
    expect(await stockAt(productId, branchB)).toBe(1);
  });
});
