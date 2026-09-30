import { Injectable, Logger } from '@nestjs/common';
import { NotificationLogService } from '../notifications/notification-log.service';
import { DeviceTokensRepository } from './device-tokens.repository';
import { FcmService, type FcmSendResult } from './fcm.service';
import { type PushContent, isPermanentTokenFailure, isSenderProblem } from './fcm-message';

/** What a send achieved. `attempted` is devices, not customers. */
export interface PushOutcome {
  attempted: number;
  delivered: number;
}

const NONE: PushOutcome = { attempted: 0, delivered: 0 };

/** Devices fetched per page of a broadcast. */
const BROADCAST_PAGE = 500;
/** Sends in flight at once during a broadcast — well inside FCM's limits. */
const BROADCAST_CONCURRENCY = 25;

/**
 * Sends push notifications to customers' devices (SPEC-11 B-1).
 *
 * PUSH IS AN OPTIMISATION, NOT A REPLACEMENT. Every notification that reaches
 * here also goes out as SMS where it always did; this adds a second, free
 * channel beside it. That is what makes it safe for push to fail quietly — a
 * customer who denied permission, has no network, or uninstalled the app still
 * gets told (SPEC-11 P0-10, Q6). Whether push may eventually SUPPRESS the SMS is
 * a product decision that needs delivery data first, and this service is what
 * produces it: every attempt is recorded in `notification_log`.
 *
 * NEVER THROWS. It is called from inside `CustomerNotificationsService.notify`,
 * itself best-effort after the mutation it reports on has already succeeded.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly devices: DeviceTokensRepository,
    private readonly fcm: FcmService,
    private readonly log: NotificationLogService,
  ) {}

  /** Sends to every live device of one customer that has not muted the category. */
  async pushToCustomer(customerId: string, content: PushContent): Promise<PushOutcome> {
    if (!this.fcm.isConfigured()) return NONE;

    try {
      const tokens = await this.devices.activeTokens(customerId, content.category);
      // No device, or every device muted this category: nothing was attempted,
      // so nothing is logged. The SMS is the channel for this customer.
      if (tokens.length === 0) return NONE;

      const results = await Promise.all(
        tokens.map(async (token) => ({ token, result: await this.fcm.send(token, content) })),
      );

      const outcome = await this.settle(results);
      await this.log.recordPush({
        recipient: `customer:${customerId}`,
        subject: content.title,
        body: content.body,
        attempted: outcome.attempted,
        delivered: outcome.delivered,
        error: firstError(results.map((r) => r.result)),
      });
      return outcome;
    } catch (err) {
      this.logger.error(`Push to customer ${customerId} failed: ${(err as Error).message}`);
      return NONE;
    }
  }

  /**
   * Sends to every live device that has not muted the category — an offer going
   * to everyone. Walks the table in pages and stops early if the SENDER is in
   * trouble, rather than hammering an unavailable FCM across every token.
   */
  async broadcast(content: PushContent): Promise<PushOutcome> {
    if (!this.fcm.isConfigured()) return NONE;

    let attempted = 0;
    let delivered = 0;
    let stoppedBecause: string | null = null;

    try {
      let after: string | null = null;
      for (;;) {
        const page = await this.devices.activePage(content.category, after, BROADCAST_PAGE);
        if (page.length === 0) break;
        after = page[page.length - 1].id;

        const results: Array<{ token: string; result: FcmSendResult }> = [];
        for (let i = 0; i < page.length; i += BROADCAST_CONCURRENCY) {
          const chunk = page.slice(i, i + BROADCAST_CONCURRENCY);
          results.push(
            ...(await Promise.all(
              chunk.map(async (d) => ({
                token: d.token,
                result: await this.fcm.send(d.token, content),
              })),
            )),
          );
        }

        const outcome = await this.settle(results);
        attempted += outcome.attempted;
        delivered += outcome.delivered;

        // Nothing got through AND every failure is about the sender, not a
        // token: FCM is down or our credentials are refused. The next page will
        // fare no better.
        const failures = results.filter((r) => !r.result.ok);
        if (
          outcome.delivered === 0 &&
          failures.length === results.length &&
          failures.every((r) => !r.result.ok && isSenderProblem(r.result.reason))
        ) {
          stoppedBecause = firstError(results.map((r) => r.result)) ?? 'FCM unavailable';
          this.logger.error(`Broadcast stopped early: ${stoppedBecause}`);
          break;
        }
      }
    } catch (err) {
      stoppedBecause = (err as Error).message;
      this.logger.error(`Broadcast failed part-way: ${stoppedBecause}`);
    }

    if (attempted > 0 || stoppedBecause) {
      await this.log.recordPush({
        recipient: `broadcast:${content.category}`,
        subject: content.title,
        body: content.body,
        attempted,
        delivered,
        error: stoppedBecause ? `stopped early: ${stoppedBecause}` : null,
      });
    }
    this.logger.log(`Broadcast "${content.category}": ${delivered}/${attempted} devices reached.`);
    return { attempted, delivered };
  }

  /**
   * Turns a batch of send results into an outcome, and switches off the tokens
   * FCM has said are permanently dead.
   *
   * Only `unregistered` and `sender_mismatch` disable a token (see
   * `isPermanentTokenFailure`). A timeout, a 5xx, a quota error or a 400 leaves
   * every token alone: those say something about this send or about us, and
   * acting on them would let one bad moment switch off devices that are fine.
   */
  private async settle(
    results: Array<{ token: string; result: FcmSendResult }>,
  ): Promise<PushOutcome> {
    const dead = results
      .filter((r) => !r.result.ok && isPermanentTokenFailure(r.result.reason))
      .map((r) => r.token);

    if (dead.length > 0) {
      try {
        await this.devices.disable(dead);
      } catch (err) {
        // The next send to a dead token fails the same way and tries again.
        this.logger.warn(
          `Could not disable ${dead.length} dead token(s): ${(err as Error).message}`,
        );
      }
    }

    return {
      attempted: results.length,
      delivered: results.filter((r) => r.result.ok).length,
    };
  }
}

/** The first failure's detail, for the log row — or null when everything worked. */
function firstError(results: FcmSendResult[]): string | null {
  for (const r of results) {
    if (!r.ok) return `${r.reason}: ${r.detail}`.slice(0, 300);
  }
  return null;
}
