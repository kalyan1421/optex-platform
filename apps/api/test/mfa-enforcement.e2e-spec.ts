// R1 1e: this file proves the enforcement PATH itself, so it turns
// enforcement back ON for its own module registry — see setup-env.ts for why
// the rest of the suite runs with it off, and why this works (Jest isolates
// each spec file's module registry, even under --runInBand).
process.env.MFA_ENFORCEMENT_ENABLED = 'true';

import crypto from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * RFC 6238 TOTP, hand-rolled rather than pulling in a dependency — the
 * algorithm is ~15 lines of HMAC-SHA1 over a 30-second time counter, the same
 * "small and stable, not worth a package" call this codebase already made for
 * prescription file-type sniffing (prescriptions.service.ts).
 */
function base32Decode(base32: string): Buffer {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const char of clean) {
    const val = ALPHABET.indexOf(char);
    if (val === -1) throw new Error(`Invalid base32 character: ${char}`);
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function computeTotp(base32Secret: string, timeStepSeconds = 30, digits = 6): string {
  const key = base32Decode(base32Secret);
  const counter = Math.floor(Date.now() / 1000 / timeStepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binCode % 10 ** digits).padStart(digits, '0');
}

describe('MFA step-up enforcement — super_admin requires aal2 (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  const userIds: string[] = [];

  const PASSWORD = 'TestPassword123!';

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

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
  });

  afterAll(async () => {
    for (const id of userIds) {
      await db.auth.admin.deleteUser(id);
    }
    await app.close();
  });

  it('refuses a valid super_admin token that has not completed 2FA (aal1)', async () => {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `mfa-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);
    await db.auth.admin.updateUserById(data.user!.id, { app_metadata: { role: 'super_admin' } });

    const { data: session, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (signInError) throw signInError;

    const res = await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .set(auth(session.session!.access_token))
      .expect(403);
    expect(res.body.message).toMatch(/step-up authentication/i);
  });

  it('grants access after a real TOTP enrollment and challenge brings the session to aal2', async () => {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: true, autoRefreshToken: false } },
    );
    const email = `mfa-e2e-aal2-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);
    await db.auth.admin.updateUserById(data.user!.id, { app_metadata: { role: 'super_admin' } });

    await anon.auth.signInWithPassword({ email, password: PASSWORD });

    // Enroll a TOTP factor — same call apps/admin's /mfa-setup page makes.
    const { data: enrolled, error: enrollError } = await anon.auth.mfa.enroll({
      factorType: 'totp',
    });
    if (enrollError) throw enrollError;

    // Verify it with a REAL computed code, not a stub — this is what actually
    // promotes the session to aal2 (GoTrue: verifying a factor for the first
    // time steps up the current session).
    const code = computeTotp(enrolled.totp.secret);
    const { data: verified, error: verifyError } = await anon.auth.mfa.challengeAndVerify({
      factorId: enrolled.id,
      code,
    });
    if (verifyError) throw verifyError;

    const res = await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .set(auth(verified.access_token))
      .expect(200);
    expect(res.body).toBeDefined();
  });
});
