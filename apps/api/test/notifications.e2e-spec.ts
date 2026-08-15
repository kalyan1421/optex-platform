import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';
import { NotificationLogService } from '../src/modules/notifications/notification-log.service';
import { CronLeaseService } from '../src/modules/cron/cron-lease.service';

/**
 * Reminder idempotency and notification durability — audit findings F-04,
 * F-05 and F-06.
 *
 * All three share a theme the old code got wrong in the same way: work that
 * looked correct on one instance, on a schedule that never slipped, with a
 * provider that never failed. These assertions remove each of those
 * assumptions in turn.
 */
describe('Notification durability and reminder idempotency (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let log: NotificationLogService;
  let lease: CronLeaseService;

  let branchId: string;
  // Migration 0011 made appointments.customer_id NOT NULL — guest booking was
  // withdrawn (CLIENT-ANSWERS B4), so every fixture needs a customer to hang off.
  let customerId: string;
  const appointmentIds: string[] = [];
  const logIds: string[] = [];

  /** Claims a bucket the way the reminder job does. */
  async function claim(bucket: '24h' | '1h', horizon = '24 hours') {
    const { data, error } = await db.rpc('claim_due_reminders', {
      p_bucket: bucket,
      p_horizon: horizon,
      p_max: 200,
    });
    if (error) throw error;
    return (data ?? []) as { id: string }[];
  }

  /** An appointment `hoursAhead` from now, eligible for reminders. */
  async function newAppointment(hoursAhead: number): Promise<string> {
    const { data, error } = await db
      .from('appointments')
      .insert({
        customer_id: customerId,
        branch_id: branchId,
        type: 'eye_test',
        scheduled_at: new Date(Date.now() + hoursAhead * 3_600_000).toISOString(),
        status: 'confirmed',
        contact_name: 'Reminder Tester',
        contact_phone: '+254712345678',
      })
      .select('id')
      .single<{ id: string }>();
    if (error) throw error;
    appointmentIds.push(data.id);
    return data.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    log = app.get(NotificationLogService);
    lease = app.get(CronLeaseService);

    db = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } },
    );

    const { data: branch } = await db
      .from('branches')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single<{ id: string }>();
    branchId = branch!.id;

    const { data: customer, error: customerError } = await db
      .from('customers')
      .insert({
        full_name: 'Reminder Tester',
        email: `reminder-e2e-${Date.now()}@optex-test.local`,
        phone: '+254712345678',
      })
      .select('id')
      .single<{ id: string }>();
    if (customerError) throw customerError;
    customerId = customer.id;
  });

  afterAll(async () => {
    if (appointmentIds.length) await db.from('appointments').delete().in('id', appointmentIds);
    if (customerId) await db.from('customers').delete().eq('id', customerId);
    if (logIds.length) await db.from('notification_log').delete().in('id', logIds);
    await db.from('cron_runs').delete().like('job', 'e2e-%');
    await app.close();
  });

  describe('reminder claiming (F-04)', () => {
    it('claims a due appointment exactly once, however many times it runs', async () => {
      // THE REGRESSION. The old job selected on a time window alone, so a
      // restart or an overrunning tick re-sent the same reminder — and the
      // columns that would have prevented it had been sitting unused in the
      // schema since migration 0008.
      const id = await newAppointment(20);

      const first = await claim('24h');
      const second = await claim('24h');

      expect(first.map((r) => r.id)).toContain(id);
      expect(second.map((r) => r.id)).not.toContain(id);
    });

    it('flags the row it claimed, so the flag reflects reality', async () => {
      const id = await newAppointment(20);
      await claim('24h');

      const { data } = await db
        .from('appointments')
        .select('reminder_24h_sent, reminder_1h_sent')
        .eq('id', id)
        .single<{ reminder_24h_sent: boolean; reminder_1h_sent: boolean }>();

      expect(data!.reminder_24h_sent).toBe(true);
      // The buckets are independent — claiming 24h must not consume the 1h send.
      expect(data!.reminder_1h_sent).toBe(false);
    });

    it('keeps the two buckets independent', async () => {
      const id = await newAppointment(0.5);

      await claim('24h'); // sweeps it into the 24h horizon too, and flags that bucket
      const oneHour = await claim('1h', '1 hour');

      expect(oneHour.map((r) => r.id)).toContain(id);
    });

    it('never claims a cancelled appointment', async () => {
      const id = await newAppointment(20);
      await db.from('appointments').update({ status: 'cancelled' }).eq('id', id);

      const claimed = await claim('24h');

      expect(claimed.map((r) => r.id)).not.toContain(id);
    });

    it('still catches an appointment whose run was missed', async () => {
      // The old window-tiling scheme dropped a reminder permanently if the run
      // that should have sent it never happened. The horizon predicate means a
      // later tick picks it up instead.
      const id = await newAppointment(3);

      const claimed = await claim('24h');

      expect(claimed.map((r) => r.id)).toContain(id);
    });

    it('rejects an unknown bucket rather than silently sending nothing', async () => {
      await expect(claim('bogus' as '24h')).rejects.toBeDefined();
    });
  });

  describe('notification log (F-06)', () => {
    it('records an intent and marks it sent', async () => {
      const id = await log.record({
        channel: 'sms',
        recipient: '+254700000001',
        body: 'e2e sent',
      });
      expect(id).toBeTruthy();
      logIds.push(id!);

      await log.markSent(id);

      const { data } = await db
        .from('notification_log')
        .select('status, sent_at')
        .eq('id', id!)
        .single<{ status: string; sent_at: string | null }>();
      expect(data!.status).toBe('sent');
      expect(data!.sent_at).toBeTruthy();
    });

    it('schedules a retry with backoff after a failure', async () => {
      const id = await log.record({
        channel: 'sms',
        recipient: '+254700000002',
        body: 'e2e retry',
      });
      logIds.push(id!);

      await log.markFailed(id, 'HTTP 502: upstream unavailable');

      const { data } = await db
        .from('notification_log')
        .select('status, attempts, last_error, next_retry_at')
        .eq('id', id!)
        .single<{
          status: string;
          attempts: number;
          last_error: string;
          next_retry_at: string | null;
        }>();

      expect(data!.status).toBe('failed');
      expect(data!.attempts).toBe(1);
      expect(data!.last_error).toContain('502');
      // Scheduled forward, not immediately — otherwise a dead provider gets
      // hammered every sweep.
      expect(new Date(data!.next_retry_at!).getTime()).toBeGreaterThan(Date.now());
    });

    it('abandons a message once the backoff schedule runs out', async () => {
      const id = await log.record({
        channel: 'email',
        recipient: 'nobody@optex-test.local',
        body: 'e2e abandon',
      });
      logIds.push(id!);

      for (let i = 0; i < 6; i++) await log.markFailed(id, 'still failing');

      const { data } = await db
        .from('notification_log')
        .select('status, next_retry_at')
        .eq('id', id!)
        .single<{ status: string; next_retry_at: string | null }>();

      expect(data!.status).toBe('abandoned');
      // Stops consuming sweep capacity, stays as the record that it never went.
      expect(data!.next_retry_at).toBeNull();
    });

    it('refuses to queue a duplicate for the same dedupe key', async () => {
      const key = `e2e-dedupe-${Date.now()}`;
      const first = await log.record({
        channel: 'sms',
        recipient: '+254700000003',
        body: 'e2e dedupe',
        dedupeKey: key,
      });
      logIds.push(first!);

      const second = await log.record({
        channel: 'sms',
        recipient: '+254700000003',
        body: 'e2e dedupe',
        dedupeKey: key,
      });

      expect(first).toBeTruthy();
      expect(second).toBeNull();
    });

    it('returns failed messages to the retry sweep once their backoff elapses', async () => {
      const id = await log.record({
        channel: 'sms',
        recipient: '+254700000004',
        body: 'e2e due',
      });
      logIds.push(id!);
      await log.markFailed(id, 'transient');
      // Pull the retry time into the past, as the passage of time would.
      await db
        .from('notification_log')
        .update({ next_retry_at: new Date(Date.now() - 60_000).toISOString() })
        .eq('id', id!);

      const due = await log.claimDue(100);

      expect(due.map((r) => r.id)).toContain(id);
    });
  });

  describe('cron lease (F-05)', () => {
    it('grants the lease to exactly one caller per window', async () => {
      const job = `e2e-lease-${Date.now()}`;

      const first = await lease.claim(job, 60);
      const second = await lease.claim(job, 60);

      // Two replicas firing on the same tick: one sweeps, one stands down.
      expect(first).toBe(true);
      expect(second).toBe(false);
    });

    it('grants it again once the lease has expired', async () => {
      const job = `e2e-lease-expiry-${Date.now()}`;

      expect(await lease.claim(job, 60)).toBe(true);
      // A zero-second lease is expired the moment it is taken.
      expect(await lease.claim(job, 0)).toBe(true);
    });

    it('keeps separate jobs from blocking one another', async () => {
      const a = `e2e-lease-a-${Date.now()}`;
      const b = `e2e-lease-b-${Date.now()}`;

      expect(await lease.claim(a, 60)).toBe(true);
      expect(await lease.claim(b, 60)).toBe(true);
    });
  });
});
