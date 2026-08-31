import crypto from 'node:crypto';

/**
 * RFC 6238 TOTP, for driving the real Super Admin 2FA step-up in tests.
 *
 * R1 1e made `aal2` mandatory for `super_admin` on every permission-gated
 * route (`PermissionsGuard`), so a test that signs a super_admin in with a
 * password alone holds an `aal1` token and gets a 403 from the API — not the
 * response it is trying to assert. Completing a genuine enrollment and
 * challenge is what the admin suite does instead of a bypass flag.
 *
 * Lifted out of `global-setup.ts` so `products.spec.ts` can mint its own aal2
 * session without a third copy of this. Deliberately still scoped to this
 * suite: the API's `mfa-enforcement.e2e-spec.ts` keeps its own independent
 * copy, which is the existing decision (two small, stable copies across two
 * packages rather than a shared test-utils package for one function) — this
 * only removes duplication *within* the admin suite.
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

export function computeTotp(base32Secret: string, timeStepSeconds = 30, digits = 6): string {
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

/**
 * Enrolls and verifies a TOTP factor on `client`'s current session, promoting
 * it to `aal2`. The client must already be signed in.
 */
export async function stepUpToAal2(client: {
  auth: {
    mfa: {
      enroll(args: { factorType: 'totp' }): Promise<{ data: any; error: any }>;
      challengeAndVerify(args: { factorId: string; code: string }): Promise<{ error: any }>;
    };
  };
}): Promise<{ factorId: string; secret: string }> {
  const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({
    factorType: 'totp',
  });
  if (enrollError) throw enrollError;
  const { error: verifyError } = await client.auth.mfa.challengeAndVerify({
    factorId: enrolled.id,
    code: computeTotp(enrolled.totp.secret),
  });
  if (verifyError) throw verifyError;
  return { factorId: enrolled.id, secret: enrolled.totp.secret };
}
