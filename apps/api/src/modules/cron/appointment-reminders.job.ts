import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';
import { SmsService } from '../notifications/sms.service';
import { CronLeaseService } from './cron-lease.service';

/** A reminder the database has claimed for us and already flagged as sent. */
interface ClaimedReminderRow {
  id: string;
  scheduled_at: string;
  status: string;
  contact_name: string | null;
  /** Guest-booking fallback phone (schema: `appointments.contact_phone`). */
  contact_phone: string | null;
  /** Joined `customers.phone` (preferred when the booking has a customer). */
  customer_phone: string | null;
}

/** Which lead-time bucket a reminder belongs to. */
type Bucket = '24h' | '1h';

const HOUR_MS = 60 * 60_000;

/**
 * How far ahead each bucket looks for unsent reminders.
 *
 * Slightly WIDER than the nominal lead time, which is the whole point: an
 * appointment whose reminder was missed because a deploy ate the run still
 * falls inside the horizon on the next tick and gets picked up. The old
 * window-tiling scheme had no such property — a missed run dropped the
 * reminder permanently.
 */
const HORIZONS: Record<Bucket, string> = {
  '24h': '24 hours',
  '1h': '1 hour',
};

/** Most reminders claimed per bucket per run. */
const BATCH = 200;

/**
 * CRON · APPOINTMENT REMINDERS.
 *
 * Every ~15 minutes, finds bookings due within each lead-time horizon (status
 * pending/confirmed/rescheduled — never cancelled/completed) and SMSes the
 * customer. Phone is the joined `customers.phone`, falling back to the
 * guest-booking `contact_phone`.
 *
 * ─── IDEMPOTENCY (audit F-04) ────────────────────────────────────────────────
 * This job used to approximate exactly-once delivery with a ±7.5-minute window
 * tiled against its own cadence, and its header claimed that `appointments` had
 * no column to track sends. That was wrong by eleven migrations: 0008 added
 * `reminder_24h_sent` and `reminder_1h_sent` for exactly this, and listed the
 * wiring as outstanding follow-up. The columns sat unused while the timing
 * heuristic quietly double-sent on any overlapping run and dropped reminders on
 * any missed one.
 *
 * Delivery is now exactly-once by construction. `claim_due_reminders`
 * (migration 0022) selects, flags and returns due rows in ONE statement, so two
 * concurrent runs cannot claim the same appointment — the second's WHERE clause
 * no longer matches. The cadence is free to change without breaking anything.
 *
 * CLAIM BEFORE SEND: the flag is set before the SMS goes out, so a send that
 * fails after claiming is not retried by this job. That is the deliberate
 * direction to fail — a missed reminder is a disappointment, a duplicate at 3am
 * is a complaint — and the failure is not actually lost: `SmsService` records it
 * in `notification_log`, where the retry sweep picks it up (F-06).
 *
 * SINGLE RUNNER: the run is additionally gated on a `CronLeaseService` claim so
 * only one replica sweeps (F-05). Strictly redundant given the atomic claim
 * above, but it keeps the pattern uniform across all three jobs and avoids N
 * replicas doing N times the database work to discover they have nothing to do.
 *
 * SAFETY: never throws — catches its own errors and logs per `Logger`.
 */
@Injectable()
export class AppointmentRemindersJob {
  private readonly logger = new Logger(AppointmentRemindersJob.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly sms: SmsService,
    private readonly lease: CronLeaseService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  @Cron('0 */15 * * * *', { name: 'appointment-reminders' })
  async sendDueReminders(): Promise<void> {
    try {
      // Lease is 14 minutes against a 15-minute cadence: long enough that a
      // second replica firing on the same tick loses, short enough that it has
      // always expired by the next legitimate run.
      if (!(await this.lease.claim('appointment-reminders', 14 * 60))) {
        return;
      }

      const sent24 = await this.processBucket('24h');
      const sent1 = await this.processBucket('1h');

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
   * Claims and sends one lead-time bucket. Returns the number delivered.
   *
   * The claim has already flagged every row it returns, so anything that goes
   * wrong below costs at most that one reminder — never a duplicate.
   */
  private async processBucket(bucket: Bucket): Promise<number> {
    const { data, error } = await this.db.rpc('claim_due_reminders', {
      p_bucket: bucket,
      p_horizon: HORIZONS[bucket],
      p_max: BATCH,
    });

    if (error) {
      this.logger.error(`Failed to claim ${bucket} reminders: ${error.message}`);
      return 0;
    }

    const rows = (data ?? []) as ClaimedReminderRow[];
    let sent = 0;

    for (const appt of rows) {
      // Prefer the linked customer's phone; fall back to the guest contact.
      const phone = (appt.customer_phone ?? appt.contact_phone ?? '').trim();
      if (!phone) {
        this.logger.debug(`Appointment ${appt.id} has no phone — skipping ${bucket} reminder.`);
        continue;
      }

      try {
        const result = await this.sms.sendSms(phone, this.buildMessage(bucket, appt), {
          // Survives a same-window retry from any other path, and makes the
          // notification_log row identifiable when someone asks whether a given
          // customer was actually reminded.
          dedupeKey: `appointment-reminder:${bucket}:${appt.id}`,
        });
        // SmsService no-ops (returns {ok:false}) without creds — that's fine,
        // it logs its own warning; we just don't count it as delivered.
        if (result.ok) sent += 1;
      } catch (err) {
        // sendSms already swallows network errors, but stay defensive so one
        // bad send can't abort the batch.
        this.logger.warn(
          `Reminder SMS failed for appointment ${appt.id}: ${(err as Error).message}`,
        );
      }
    }

    return sent;
  }

  /** Composes the reminder copy for a bucket. */
  private buildMessage(bucket: Bucket, appt: ClaimedReminderRow): string {
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

/** Exported for the unit tests that pin the copy and the horizon table. */
export const __testing = { HORIZONS, HOUR_MS, BATCH };
