import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';
import { SmsService } from '../notifications/sms.service';

/** Appointment row + joined customer phone, as selected below. */
interface ReminderRow {
  id: string;
  scheduled_at: string;
  status: string;
  contact_name: string | null;
  /** Guest-booking fallback phone (schema: `appointments.contact_phone`). */
  contact_phone: string | null;
  /** Joined `customers.phone` (preferred when the booking has a customer). */
  customer: { phone: string | null } | null;
}

/** Which lead-time bucket a reminder belongs to. */
type Bucket = '24h' | '1h';

/**
 * Statuses that should still receive a reminder. A `cancelled` or `completed`
 * appointment must NOT be reminded.
 */
const REMINDABLE_STATUSES = ['pending', 'confirmed', 'rescheduled'] as const;

/**
 * The cron cadence in minutes — the idempotency window is derived from this so
 * each appointment lands in each bucket about once. MUST match the @Cron below.
 */
const RUN_CADENCE_MIN = 15;
/**
 * Half the cadence, in ms. We centre a window of width = cadence on each target
 * lead-time (24h / 1h ahead). Width == cadence means consecutive runs tile the
 * timeline with neither gaps (missed reminders) nor overlaps (duplicates).
 */
const HALF_WINDOW_MS = (RUN_CADENCE_MIN / 2) * 60_000;
const HOUR_MS = 60 * 60_000;

/**
 * CRON · APPOINTMENT REMINDERS.
 *
 * Every ~15 minutes, finds bookings due in ~24h and in ~1h (status in
 * pending/confirmed/rescheduled — never cancelled/completed) and SMSes the
 * customer. Phone is the joined `customers.phone`, falling back to the
 * guest-booking `contact_phone`.
 *
 * ─── IDEMPOTENCY (IMPORTANT — read before changing the cadence) ──────────────
 * The `appointments` table (migration 0001) has NO reminder-tracking column, so
 * there is nothing durable to mark "already reminded". We approximate
 * exactly-once delivery with a TIME WINDOW matched to the run cadence: each run
 * selects appointments whose `scheduled_at` falls within ±(cadence/2) of "now +
 * lead-time". Because the window width equals the cadence, consecutive runs tile
 * the timeline edge-to-edge — an appointment crosses each bucket's window on
 * essentially one run, so it gets ~one SMS per bucket.
 *
 * This is best-effort, NOT bullet-proof: a missed run (deploy/restart) drops a
 * reminder; a run that overruns into the next tick, a clock skew, or a manual
 * trigger can double-send. The cadence here MUST equal `RUN_CADENCE_MIN` for the
 * window math to hold.
 *
 * RECOMMENDED MIGRATION (robust fix): add nullable booleans
 *   `reminder_24h_sent boolean not null default false`
 *   `reminder_1h_sent  boolean not null default false`
 * to `appointments` (or a `reminder_log(appointment_id, bucket, sent_at)` table
 * with a unique (appointment_id, bucket) key). Then this job filters on
 * `reminder_*_sent = false` and flips the flag in the same transaction after a
 * successful send — making it exactly-once and resilient to missed/overlapping
 * runs. Until that ships, the window above is the cleanest possible idempotency
 * with the columns that exist.
 *
 * SAFETY: never throws — catches its own errors and logs per `Logger`.
 */
@Injectable()
export class AppointmentRemindersJob {
  private readonly logger = new Logger(AppointmentRemindersJob.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly sms: SmsService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  // @nestjs/schedule has no built-in 15-min CronExpression, so we use a cron
  // string: runs at :00, :15, :30, :45 every hour — matching RUN_CADENCE_MIN=15
  // (the window math in this file depends on cadence == 15).
  @Cron('0 */15 * * * *', { name: 'appointment-reminders' })
  async sendDueReminders(): Promise<void> {
    try {
      const now = Date.now();
      const sent24 = await this.processBucket('24h', now + 24 * HOUR_MS);
      const sent1 = await this.processBucket('1h', now + HOUR_MS);

      if (sent24 + sent1 > 0) {
        this.logger.log(`Appointment reminders sent — 24h: ${sent24}, 1h: ${sent1}.`);
      } else {
        this.logger.debug('Appointment reminders: nothing due this run.');
      }
    } catch (err) {
      // A thrown cron job is just noise — swallow and log.
      this.logger.error(`Appointment reminders run failed: ${(err as Error).message}`);
    }
  }

  /**
   * Sends reminders for one lead-time bucket. `targetMs` is the ideal moment a
   * reminder fires (now + lead-time); we select appointments whose
   * `scheduled_at` is within ±HALF_WINDOW_MS of it. Returns the count sent.
   */
  private async processBucket(bucket: Bucket, targetMs: number): Promise<number> {
    const windowStart = new Date(targetMs - HALF_WINDOW_MS).toISOString();
    const windowEnd = new Date(targetMs + HALF_WINDOW_MS).toISOString();

    const { data, error } = await this.db
      .from('appointments')
      .select(
        'id, scheduled_at, status, contact_name, contact_phone, customer:customers!customer_id(phone)',
      )
      .gte('scheduled_at', windowStart)
      .lt('scheduled_at', windowEnd)
      .in('status', REMINDABLE_STATUSES as unknown as string[])
      .order('scheduled_at', { ascending: true })
      .limit(200);

    if (error) {
      this.logger.error(`Failed to load ${bucket} reminder appointments: ${error.message}`);
      return 0;
    }

    const rows = (data ?? []) as unknown as ReminderRow[];
    let sent = 0;

    for (const appt of rows) {
      // Prefer the linked customer's phone; fall back to the guest contact_phone.
      const phone = (appt.customer?.phone ?? appt.contact_phone ?? '').trim();
      if (!phone) {
        this.logger.debug(`Appointment ${appt.id} has no phone — skipping ${bucket} reminder.`);
        continue;
      }

      try {
        const result = await this.sms.sendSms(phone, this.buildMessage(bucket, appt));
        // SmsService no-ops (returns {ok:false}) without creds — that's fine,
        // it logs its own warning; we just don't count it as delivered.
        if (result.ok) sent += 1;
      } catch (err) {
        // sendSms already swallows network errors, but stay defensive so one
        // bad send can't abort the bucket.
        this.logger.warn(
          `Reminder SMS failed for appointment ${appt.id}: ${(err as Error).message}`,
        );
      }
    }

    return sent;
  }

  /** Composes the reminder copy for a bucket. */
  private buildMessage(bucket: Bucket, appt: ReminderRow): string {
    const who = appt.contact_name?.trim() ? `${appt.contact_name.trim()}, ` : '';
    const when = this.formatNairobi(appt.scheduled_at);
    const lead = bucket === '24h' ? 'tomorrow' : 'in about an hour';
    return (
      `${who}reminder: your Optex Opticians appointment is ${lead} ` +
      `(${when} EAT). Reply or call us to reschedule. Asante!`
    );
  }

  /**
   * Formats an ISO timestamp in Africa/Nairobi (fixed +03:00, no DST) as
   * `Mon DD, HH:mm` for the SMS body.
   */
  private formatNairobi(iso: string): string {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Nairobi',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }
}
