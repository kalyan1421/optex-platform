import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators';
import type { Env } from '../../config/env';
import { ContactDto } from './dto/contact.dto';
import { EmailService } from './email.service';

/**
 * Submissions allowed per hour, per caller. Resolved per request rather than
 * captured in a `const` so it stays overridable at runtime — the same idiom as
 * `authRateLimit` in `auth.controller.ts`, and what lets the e2e suite raise it.
 */
const contactRateLimit = (): number => Number(process.env.CONTACT_RATE_LIMIT ?? 5);

/** Response for an accepted contact submission. */
interface ContactResponse {
  ok: true;
}

/**
 * Public contact-form endpoint. Mounted at `/api/contact` (global prefix
 * applied in `main.ts`). Forwards submissions to the configured inbox via
 * Resend, replacing the previously fake front-end submit (MISSING_FEATURES
 * C-3).
 *
 * Audit B-01: this is unauthenticated and sends an email per request, so on
 * the global bucket it was a 300-emails-per-minute amplifier for anyone with
 * a socket. The cost lands twice — Resend bills per send, and a flood from
 * this domain to one inbox is how the sending reputation that order
 * confirmations and password resets depend on gets burned. Five an hour is
 * far more than a person submits and far less than abuse needs.
 */
@ApiTags('notifications')
@Controller('contact')
export class ContactController {
  private static readonly DEFAULT_INBOX = 'hello@optexopticians.co.ke';

  constructor(
    private readonly email: EmailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 3_600_000, limit: contactRateLimit } })
  @Post()
  @ApiOperation({ summary: 'Submit the public contact form' })
  @ApiOkResponse({
    description: 'Submission accepted and forwarded to the contact inbox',
    schema: { example: { ok: true } },
  })
  async submit(@Body() dto: ContactDto): Promise<ContactResponse> {
    const inbox =
      this.config.get('CONTACT_INBOX', { infer: true }) ?? ContactController.DEFAULT_INBOX;

    const subject = `[Contact] ${dto.subject ?? 'New enquiry'}`;
    const lines = [
      `Name: ${dto.name}`,
      `Email: ${dto.email}`,
      ...(dto.phone ? [`Phone: ${dto.phone}`] : []),
      ...(dto.subject ? [`Subject: ${dto.subject}`] : []),
      '',
      dto.message,
    ];
    const text = lines.join('\n');
    const html = lines.map((line) => (line === '' ? '<br/>' : escapeHtml(line))).join('<br/>');

    await this.email.sendEmail({ to: inbox, subject, text, html });

    return { ok: true };
  }
}

/** Escapes HTML-significant characters to keep the email body safe. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
