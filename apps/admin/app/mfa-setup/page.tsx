'use client';

/**
 * TOTP enrollment for a Super Admin who has never set up 2FA — SPEC-08's "2FA
 * | Super Admin". Client-side and directly against Supabase (not proxied
 * through the API): MFA enrollment/challenge inherently belongs to the
 * browser session that will be stepped up, matching this codebase's existing
 * split between API-proxied auth (login/signup/password reset) and
 * browser-native session mechanics.
 */

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@optex/db/browser';
import { api } from '../../lib/api';
import { firstPermittedRoute } from '../../lib/route-permissions';

interface Enrollment {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
}

export default function MfaSetupPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(true);
  // Guards against React StrictMode's dev-only double-invoke of this effect.
  // A `cancelled`-flag (the usual pattern for effects that just fetch) is NOT
  // enough here: `enroll()` is a real mutation with a friendly-name
  // uniqueness constraint, so two concurrent invocations don't just waste a
  // request, they race each other and one comes back a hard error. This ref
  // ensures the whole prepare-and-enroll sequence runs at most once per
  // mounted instance, full stop, rather than trying to reconcile two
  // in-flight attempts against each other's results.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function prepare() {
      // Already has a verified factor — this is the challenge page's job, not
      // this one's. Don't let a second TOTP factor get enrolled by accident.
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError(listError.message);
        return;
      }
      if (factors.totp.length > 0) {
        router.replace('/mfa-challenge');
        return;
      }

      // A previous enrollment attempt abandoned mid-way (closed tab,
      // refreshed before entering a code) leaves an `unverified` factor
      // behind. GoTrue rejects a second enroll() with the same friendly
      // name, so without this a user who didn't finish setup the first time
      // would be stuck here permanently. `factors.totp` above only lists
      // VERIFIED ones, so this stale row wouldn't have been caught by the
      // check above it.
      const staleUnverified = factors.all.filter(
        (f) => f.factor_type === 'totp' && f.status === 'unverified',
      );
      for (const stale of staleUnverified) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Optex Admin',
      });
      if (enrollError) {
        setError(enrollError.message);
        return;
      }
      setEnrollment({
        factorId: data.id,
        qrCodeSvg: data.totp.qr_code,
        secret: data.totp.secret,
      });
    }

    prepare().finally(() => setPreparing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollment) return;
    setError('');
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.factorId,
        code: code.trim(),
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      let destination = '/dashboard';
      try {
        const me = await api.auth.me();
        const route = firstPermittedRoute(me.permissions);
        if (route) destination = `/${route}`;
      } catch {
        // Falls back to /dashboard.
      }
      router.push(destination);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-10">
      <div className="mb-8 flex flex-col items-center">
        <Image
          src="/images/Logo.png"
          alt="Optex"
          width={120}
          height={60}
          priority
          className="mb-4 object-contain"
          style={{ height: 60, width: 'auto' }}
        />
        <p className="text-sm font-medium text-gray-500">Admin Panel</p>
      </div>

      <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Set up two-factor authentication</h1>
        <p className="mb-6 text-sm text-gray-500">
          Super Admin accounts require an authenticator app (Google Authenticator, 1Password, Authy,
          etc.) before continuing.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {preparing ? (
          <p className="text-sm text-gray-400">Preparing your enrollment…</p>
        ) : enrollment ? (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex justify-center rounded-xl border border-gray-200 bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URI SVG, next/image cannot optimize this */}
              <img
                src={enrollment.qrCodeSvg}
                alt="Scan this QR code with your authenticator app"
                width={200}
                height={200}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Can&apos;t scan? Enter this key manually
              </label>
              <code className="block w-full break-all rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
                {enrollment.secret}
              </code>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Enter the 6-digit code to confirm
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={6}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-lg tracking-[0.5em] text-gray-900 outline-none transition-colors placeholder:tracking-normal placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-[#2A3182] py-3 text-sm font-bold text-white transition-colors hover:bg-[#1a1a5c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Confirming…' : 'Confirm & Enable'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
