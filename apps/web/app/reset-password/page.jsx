'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@optex/db/browser';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase processes the #access_token hash fragment automatically on mount
    const db = createBrowserSupabase();
    db.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      } else {
        setError('Invalid or expired reset link. Please request a new one.');
      }
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirmPw) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    const db = createBrowserSupabase();
    const { error: updateError } = await db.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-[#1A1A2E]">Set New Password</h1>
          <p className="text-sm text-gray-500">Choose a strong password for your account.</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          {done ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Password updated!</h2>
              <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
              <Link
                href="/login"
                className="mt-2 inline-block text-sm font-semibold text-[#2A3182] hover:underline"
              >
                Sign In now
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                  {error.includes('expired') && (
                    <span>
                      {' '}
                      <Link href="/forgot-password" className="font-semibold underline">
                        Request new link
                      </Link>
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  required
                  placeholder="Repeat your new password"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !sessionReady}
                className="w-full rounded-xl bg-[#2A3182] py-3 text-sm font-bold text-white transition-colors hover:bg-[#1a1a5c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Updating…' : 'Set New Password'}
              </button>

              {!sessionReady && !error && (
                <p className="text-center text-xs text-gray-400">Verifying reset link…</p>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
