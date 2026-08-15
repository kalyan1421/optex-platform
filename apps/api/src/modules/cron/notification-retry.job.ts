import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailService } from '../notifications/email.service';
import { NotificationLogService } from '../notifications/notification-log.service';
import { SmsService } from '../notifications/sms.service';
import { CronLeaseService } from './cron-lease.service';

/** Most notifications retried per run — keeps a backlog from monopolising a tick. */
const BATCH = 50;

/**
 * CRON · NOTIFICATION RETRY (audit F-06).
 *
 * The half of the fix that makes `notification_log` worth having. Recording a
 * failed send is only useful if something later acts on the record.
 *
 * Every ~5 minutes this picks up rows whose backoff has elapsed and re-sends
 * them through the same channel service, passing the existing `logId` so the
 * attempt updates the original row rather than queueing a new one. The service
 * marks it `sent`, or schedules the next attempt, or abandons it once the
 * backoff schedule runs out.
 *
 * The practical effect: an Africa's Talking or Resend blip becomes a delay
 * instead of a permanent loss. Order confirmations and appointment reminders
 * sent during an outage arrive once the provider recovers, with no manual
 * intervention and no customer phoning in to ask why they heard nothing.
 *
 * SAFETY: never throws. Single-runner via `CronLeaseService` — without the
 * lease, two replicas would send every backlogged message twice, which is
 * precisely the failure this whole subsystem exists to prevent.
 */
@Injectable()
export class NotificationRetryJob {
  private readonly logger = new Logger(NotificationRetryJob.name);

  constructor(
    private readonly log: NotificationLogService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
    private readonly lease: CronLeaseService,
  ) {}

  @Cron('0 */5 * * * *', { name: 'notification-retry' })
  async retryDue(): Promise<void> {
    try {
      // 4 minutes against a 5-minute cadence — see AppointmentRemindersJob.
      if (!(await this.lease.claim('notification-retry', 4 * 60))) {
        return;
      }

      const due = await this.log.claimDue(BATCH);
      if (due.length === 0) {
        this.logger.debug('Notification retry: nothing due this run.');
        return;
      }

      let delivered = 0;

      for (const row of due) {
        try {
          const result =
            row.channel === 'sms'
              ? await this.sms.sendSms(row.recipient, row.body, { logId: row.id })
              : await this.email.sendEmail({
                  to: row.recipient,
                  subject: row.subject ?? 'Optex Opticians',
                  text: row.body,
                  logId: row.id,
                });

          if (result.ok) delivered += 1;
        } catch (err) {
          // The channel services already record their own failures against the
          // row; this only stops one bad message aborting the batch.
          this.logger.warn(`Retry threw for notification ${row.id}: ${(err as Error).message}`);
        }
      }

      this.logger.log(`Notification retry: ${delivered}/${due.length} delivered.`);
    } catch (err) {
      this.logger.error(`Notification retry run failed: ${(err as Error).message}`);
    }
  }
}
