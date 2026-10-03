import { createVerify, generateKeyPairSync } from 'node:crypto';
import {
  FCM_SCOPE,
  GOOGLE_TOKEN_URL,
  buildAssertion,
  parseServiceAccount,
} from '../../src/modules/push/google-auth';

/**
 * The service-account JWT that authenticates the API to FCM (SPEC-11 B-1).
 *
 * A wrong claim or a wrong signature would show up only as Google refusing every
 * push in production, with an error that says nothing about which part is wrong.
 * So the assertion is verified here independently — against the matching public
 * key, with the claims decoded and checked — rather than trusted to "look right".
 */

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const KEY_FILE = {
  type: 'service_account',
  project_id: 'optex-opticians',
  client_email: 'fcm-sender@optex-opticians.iam.gserviceaccount.com',
  private_key: privateKey,
};

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

describe('buildAssertion', () => {
  const account = parseServiceAccount(JSON.stringify(KEY_FILE))!;
  const now = Date.UTC(2026, 8, 30, 12, 0, 0);
  const jwt = buildAssertion(account, now);
  const [header, claims, signature] = jwt.split('.');

  it('is a three-part RS256 JWT', () => {
    expect(jwt.split('.')).toHaveLength(3);
    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
  });

  it('carries the claims Google requires', () => {
    expect(decode(claims)).toEqual({
      iss: KEY_FILE.client_email,
      scope: FCM_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 3600,
    });
  });

  it('asks for the messaging scope and nothing broader', () => {
    expect(decode(claims).scope).toBe('https://www.googleapis.com/auth/firebase.messaging');
  });

  it('is signed with the account key, verifiable with the matching public key', () => {
    const verifier = createVerify('RSA-SHA256').update(`${header}.${claims}`);
    expect(verifier.verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
  });

  it('does not verify against a different key, or after any part is altered', () => {
    const other = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const sig = Buffer.from(signature, 'base64url');

    expect(
      createVerify('RSA-SHA256').update(`${header}.${claims}`).verify(other.publicKey, sig),
    ).toBe(false);

    const tampered = Buffer.from(
      JSON.stringify({ ...decode(claims), iss: 'attacker@example.com' }),
    ).toString('base64url');
    expect(createVerify('RSA-SHA256').update(`${header}.${tampered}`).verify(publicKey, sig)).toBe(
      false,
    );
  });

  it('uses the clock it is given, so expiry is predictable', () => {
    const later = buildAssertion(account, now + 90_000).split('.')[1];
    expect(decode(later).iat).toBe(Math.floor(now / 1000) + 90);
  });
});

describe('parseServiceAccount', () => {
  it('reads the key file JSON', () => {
    expect(parseServiceAccount(JSON.stringify(KEY_FILE))).toEqual({
      client_email: KEY_FILE.client_email,
      private_key: privateKey,
      project_id: 'optex-opticians',
    });
  });

  it('reads it base64-encoded — the form that survives a hosting dashboard', () => {
    const b64 = Buffer.from(JSON.stringify(KEY_FILE)).toString('base64');
    expect(parseServiceAccount(b64)).toMatchObject({ client_email: KEY_FILE.client_email });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseServiceAccount(`\n  ${JSON.stringify(KEY_FILE)}  \n`)).not.toBeNull();
  });

  it('leaves project_id undefined when the file has none', () => {
    const { project_id: _omit, ...rest } = KEY_FILE;
    expect(parseServiceAccount(JSON.stringify(rest))?.project_id).toBeUndefined();
  });

  // The value contains a private key. Whatever is wrong with it, this must
  // return null quietly — never throw, and (by construction) never log.
  it.each([
    ['undefined', undefined],
    ['an empty string', ''],
    ['whitespace', '   '],
    ['not JSON or base64 of JSON', 'this is not a key'],
    ['JSON that is not an object', '[1,2,3]'],
    ['JSON missing the email', JSON.stringify({ private_key: privateKey })],
    ['JSON missing the key', JSON.stringify({ client_email: KEY_FILE.client_email })],
    ['an email with no @', JSON.stringify({ ...KEY_FILE, client_email: 'nobody' })],
    ['a key that is not PEM', JSON.stringify({ ...KEY_FILE, private_key: 'hunter2' })],
    ['truncated JSON', JSON.stringify(KEY_FILE).slice(0, 40)],
  ])('returns null for %s', (_label, raw) => {
    expect(parseServiceAccount(raw as string | undefined)).toBeNull();
  });
});
