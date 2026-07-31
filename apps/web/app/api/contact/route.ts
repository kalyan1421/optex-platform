import { NextRequest, NextResponse } from 'next/server';

// Required env vars:
//   RESEND_API_KEY   — get from https://resend.com/api-keys
//   CONTACT_EMAIL    — destination address (defaults to hello@optexopticians.co.ke)

// C-2 FIX: Escape user-supplied strings before inserting into HTML.
// Prevents HTML/script injection in the admin inbox.
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Simple in-process rate limiter: max 5 submissions per IP per 60 seconds.
// For production scale replace with Upstash Redis + @upstash/ratelimit.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  // C-3 FIX: Rate limit by client IP before doing any work.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute before trying again.' },
      { status: 429 },
    );
  }

  const { name, email, phone, subject, message } = await req.json();

  // Basic validation
  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 });
  }

  // Validate email format to prevent header injection
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_EMAIL || 'hello@optexopticians.co.ke';

  // If no API key configured, just log and return success (dev mode)
  if (!apiKey) {
    console.log('[Contact Form]', { name, email, phone, subject, message });
    return NextResponse.json({ success: true });
  }

  // C-2 FIX: Escape all user-supplied values before embedding in HTML.
  const safeName = escHtml(String(name));
  const safeEmail = escHtml(String(email));
  const safePhone = phone ? escHtml(String(phone)) : '—';
  const safeSubject = subject ? escHtml(String(subject)) : '—';
  const safeMessage = escHtml(String(message));

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'OPTEX Contact <noreply@optexopticians.co.ke>',
      to: [toEmail],
      reply_to: safeEmail,
      subject: `[OPTEX Contact] ${safeSubject === '—' ? 'New Message' : safeSubject} — ${safeName}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Name</td><td style="padding:8px">${safeName}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Email</td><td style="padding:8px">${safeEmail}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Phone</td><td style="padding:8px">${safePhone}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Subject</td><td style="padding:8px">${safeSubject}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5;vertical-align:top">Message</td><td style="padding:8px;white-space:pre-wrap">${safeMessage}</td></tr>
        </table>
      `,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('[Resend error]', error);
    return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
