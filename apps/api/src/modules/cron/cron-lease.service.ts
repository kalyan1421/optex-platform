import { Injectable, Logger } from '@nestjs/common';
import { hostname } from 'node:os';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Leader election for scheduled jobs (audit finding F-05).
 *
 * `@nestjs/schedule` fires every `@Cron` on every process that is running. With
 * one container that is invisible; with two it means the same M-Pesa
 * transactions polled twice, the same reminder SMS sent twice, and two
 * auto-decline sweeps racing the same rows. Since horizontal scaling is the
 * remedy for the rate-limit pressure in F-01, that made this the finding
 * blocking the platform's own scaling story.
 *
 * `claim()` wraps the `try_claim_cron_run` RPC (migration 0021): exactly one
 * caller per lease window gets `true`, everyone else gets `false` and returns
 * immediately.
 *
 * FAILURE POSTURE: if the claim itself errors — database unreachable, RPC
 * missing — this returns FALSE and the job skips. Skipping one run of an
 * idempotent sweep costs nothing and the next tick retries; assuming leadership
 * on an error would reintroduce exactly the duplicate-send problem the lease
 * exists to prevent. Availability of a fifteen-minute sweep is worth less than
 * not texting a customer twice.
 */
@Injectable()
export class CronLeaseService {
  private readonly logger = new Logger(CronLeaseService.name);

  /** Identifies the holder in `cron_runs.claimed_by`, for debugging a stuck lease. */
  private readonly runnerId = `${hostname()}:${process.pid}`;

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Attempts to become the runner for `job` for the next `leaseSeconds`.
   *
   * The lease should be slightly SHORTER than the cron interval. Longer and a
   * tick gets skipped because the previous lease has not expired; much shorter
   * and a slow run could overlap with the next one.
   */
  async claim(job: string, leaseSeconds: number): Promise<boolean> {
    const { data, error } = await this.supabase.client.rpc('try_claim_cron_run', {
      p_job: job,
      p_lease: `${leaseSeconds} seconds`,
      p_runner: this.runnerId,
    });

    if (error) {
      this.logger.warn(`Could not claim the "${job}" lease — skipping this run: ${error.message}`);
      return false;
    }

    if (data !== true) {
      this.logger.debug(`Another instance holds the "${job}" lease — skipping this run.`);
      return false;
    }

    return true;
  }
}
