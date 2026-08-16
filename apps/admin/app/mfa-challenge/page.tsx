'use client';

/**
 * Step-up challenge for a Super Admin session that hasn't completed 2FA this
 * sign-in (aal1) — `middleware.ts` redirects here. Mirrors
 * `apps/api/src/auth/permissions.guard.ts`'s server-side aal2 requirement;
 * this page is what makes that requirement satisfiable rather than just a
 * wall of 403s.
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@optex/db/browser';
import { api } from '../../lib/api';
import { firstPermittedRoute } from '../../lib/route-permissions';

export default function MfaChallengePage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingFactor, setCheckingFactor] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.mfa
      .listFactors()
      .then(({ data, error: listError }) => {
        if (cancelled) return;
        if (listError) {
          setError(listError.message);
          return;
        }
        const verified = data.totp[0];
        if (!verified) {
          // No verified factor yet — this account has never completed
          // enrollment. Send them there instead of asking for a code that
          // doesn't exist.
          router.replace('/mfa-setup');
          return;
        }
        setFactorId(verified.id);
      })
      .finally(() => {
        if (!cancelled) setCheckingFactor(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError('');
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
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
        // Falls back to /dashboard — PermissionGate handles a role with no
        // reachable page rather than this failing the whole step-up.
      }
      router.push(destination);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
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
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Two-factor verification</h1>
        <p className="mb-6 text-sm text-gray-500">
          Enter the 6-digit code from your authenticator app.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {checkingFactor ? (
          <p className="text-sm text-gray-400">Checking your account…</p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Code</label>
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
              disabled={loading || !factorId}
              className="mt-2 w-full rounded-xl bg-[#2A3182] py-3 text-sm font-bold text-white transition-colors hover:bg-[#1a1a5c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Sign in as someone else
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
