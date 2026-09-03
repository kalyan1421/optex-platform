'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

const BackArrowIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const LockIcon = () => (
  <svg
    className="h-6 w-6 text-[#2A3182]"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
);

/** Password field with a text/reveal toggle, matching the login page's UX. */
function PasswordField({ id, label, value, onChange, autoComplete, hint }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-gray-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-16 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 hover:text-[#2A3182]"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function SecurityPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?redirect=/profile/security');
  }, [authLoading, user, router]);

  if (authLoading) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword.length < 6) {
      setError('Your new password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Your new password must be different from your current one.');
      return;
    }

    setLoading(true);
    try {
      // Prove the caller actually knows the current password before changing
      // it — `POST /auth/login` either succeeds or throws; the session it
      // returns is discarded (never passed to `supabase.auth.setSession`),
      // so this check never disturbs the tab's real, already-signed-in
      // session.
      await api.auth.login({ email: user.email, password: currentPassword });
    } catch {
      setError('Current password is incorrect.');
      setLoading(false);
      return;
    }

    try {
      // Operates on whichever session is active — the customer's ordinary
      // signed-in one here, not only a reset-link recovery session. See the
      // client's own comment on this call for the detail.
      await api.auth.resetPassword({ password: newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err?.message ?? 'Could not update your password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] pb-16 pt-[15px] sm:pb-24">
      <div className="site-container max-w-[560px]">
        <Link
          href="/profile"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#2A3182]"
        >
          <BackArrowIcon />
          Back to Account
        </Link>

        <div className="rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm sm:rounded-[32px] sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50">
              <LockIcon />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-[#1a1a1a]">Security &amp; Password</h1>
              <p className="text-[13px] text-gray-500">
                Signed in as <span className="font-medium text-gray-700">{user?.email}</span>
              </p>
            </div>
          </div>

          {success ? (
            <div className="flex items-start gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3">
              <CheckCircleIcon />
              <div>
                <p className="text-sm font-semibold text-green-800">Password updated</p>
                <p className="mt-0.5 text-sm text-green-700">
                  You&rsquo;ll stay signed in on this device. If you&rsquo;re signed in elsewhere,
                  you may need to sign in again there with the new password.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
                >
                  {error}
                </div>
              )}

              <PasswordField
                id="current-password"
                label="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <PasswordField
                id="new-password"
                label="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                hint="At least 6 characters."
              />
              <PasswordField
                id="confirm-new-password"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#2A3182] py-3 text-sm font-bold text-white transition-colors hover:bg-[#1a1a5c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
