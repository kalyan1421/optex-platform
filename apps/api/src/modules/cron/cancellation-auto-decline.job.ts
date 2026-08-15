import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CancellationService } from '../orders/cancellation.service';
import { CronLeaseService } from './cron-lease.service';

/**
 * CRON · CANCELLATION AUTO-DECLINE (SPEC-06 R9).
 *
 * A pending cancellation request that nobody answers is, in effect, a
 * decision by inaction — the customer is left not knowing whether their
 * order is going to ship. Every ~15 minutes this sweeps
 * `order_cancellation_requests` for rows past the configurable
 * `cancellation.auto_decline_hours` threshold ({@link CancellationService})
 * and declines them, notifying the customer the same way a human decline
 * does.
 *
 * The sweep itself is a single bulk UPDATE — see
 * {@link CancellationService.autoDeclineStale} for why that's also the
 * concurrency guard against a human deciding the same row mid-run.
 *
 * SAFETY: never throws — a thrown cron job is just noise.
 */
@Injectable()
export class CancellationAutoDeclineJob {
  private readonly logger = new Logger(CancellationAutoDeclineJob.name);

  constructor(
    private readonly cancellation: CancellationService,
    private readonly lease: CronLeaseService,
  ) {}

  @Cron('0 */15 * * * *', { name: 'cancellation-auto-decline' })
  async sweep(): Promise<void> {
    try {
      // F-05: one runner across replicas. The bulk UPDATE is already its own
      // concurrency guard against a human deciding the same row, but two
      // replicas sweeping would still each notify the affected customers.
      if (!(await this.lease.claim('cancellation-auto-decline', 14 * 60))) {
        return;
      }

      const { declined } = await this.cancellation.autoDeclineStale();
      if (declined > 0) {
        this.logger.log(`Auto-declined ${declined} stale cancellation request(s).`);
      } else {
        this.logger.debug('Auto-decline sweep: nothing stale this run.');
      }
    } catch (err) {
      this.logger.error(`Auto-decline sweep threw: ${(err as Error).message}`);
    }
  }
}
