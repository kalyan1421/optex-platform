'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabase } from '@optex/db/browser';
import { api } from '../../lib/api';

const MailIcon = () => (
  <svg
    className="h-[18px] w-[22.5px] text-[#767683] lg:h-[16px] lg:w-[20px]"
    fill="none"
    viewBox="0 0 20 16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 16C1.45 16 0.979167 15.8042 0.5875 15.4125C0.195833 15.0208 0 14.55 0 14V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H18C18.55 0 19.0208 0.195833 19.4125 0.5875C19.8042 0.979167 20 1.45 20 2V14C20 14.55 19.8042 15.0208 19.4125 15.4125C19.0208 15.8042 18.55 16 18 16H2ZM10 9L2 4V14H18V4L10 9ZM10 7L18 2H2L10 7ZM2 4V2V4V14V4Z"
      fill="currentColor"
    />
  </svg>
);

const LockIcon = () => (
  <svg
    className="h-[18px] w-[22.5px] text-[#767683] lg:h-[21px] lg:w-[16px]"
    fill="none"
    viewBox="0 0 16 21"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 21C1.45 21 0.979167 20.8042 0.5875 20.4125C0.195833 20.0208 0 19.55 0 19V9C0 8.45 0.195833 7.97917 0.5875 7.5875C0.979167 7.19583 1.45 7 2 7H3V5C3 3.61667 3.4875 2.4375 4.4625 1.4625C5.4375 0.4875 6.61667 0 8 0C9.38333 0 10.5625 0.4875 11.5375 1.4625C12.5125 2.4375 13 3.61667 13 5V7H14C14.55 7 15.0208 7.19583 15.4125 7.5875C15.8042 7.97917 16 8.45 16 9V19C16 19.55 15.8042 20.0208 15.4125 20.4125C15.0208 20.8042 14.55 21 14 21H2ZM2 19H14V9H2V19ZM8 16C8.55 16 9.02083 15.8042 9.4125 15.4125C9.80417 15.0208 10 14.55 10 14C10 13.45 9.80417 12.9792 9.4125 12.5875C9.02083 12.1958 8.55 12 8 12C7.45 12 6.97917 12.1958 6.5875 12.5875C6.19583 12.9792 6 13.45 6 14C6 14.55 6.19583 15.0208 6.5875 15.4125C6.97917 15.8042 7.45 16 8 16ZM5 7H11V5C11 4.16667 10.7083 3.45833 10.125 2.875C9.54167 2.29167 8.83333 2 8 2C7.16667 2 6.45833 2.29167 5.875 2.875C5.29167 3.45833 5 4.16667 5 5V7ZM2 19V9V19Z"
      fill="currentColor"
    />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    className="h-[18px] w-[22.5px] cursor-pointer text-[#767683] transition-colors hover:text-gray-600 lg:h-[20px] lg:w-[22px]"
    fill="none"
    viewBox="0 0 22 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15.1 10.5L13.65 9.05C13.8 8.26667 13.575 7.53333 12.975 6.85C12.375 6.16667 11.6 5.9 10.65 6.05L9.2 4.6C9.48333 4.46667 9.77083 4.36667 10.0625 4.3C10.3542 4.23333 10.6667 4.2 11 4.2C12.25 4.2 13.3125 4.6375 14.1875 5.5125C15.0625 6.3875 15.5 7.45 15.5 8.7C15.5 9.03333 15.4667 9.34583 15.4 9.6375C15.3333 9.92917 15.2333 10.2167 15.1 10.5ZM18.3 13.65L16.85 12.25C17.4833 11.7667 18.0458 11.2375 18.5375 10.6625C19.0292 10.0875 19.45 9.43333 19.8 8.7C18.9667 7.01667 17.7708 5.67917 16.2125 4.6875C14.6542 3.69583 12.9167 3.2 11 3.2C10.5167 3.2 10.0417 3.23333 9.575 3.3C9.10833 3.36667 8.65 3.46667 8.2 3.6L6.65 2.05C7.33333 1.76667 8.03333 1.55417 8.75 1.4125C9.46667 1.27083 10.2167 1.2 11 1.2C13.5167 1.2 15.7583 1.89583 17.725 3.2875C19.6917 4.67917 21.1167 6.48333 22 8.7C21.6167 9.68333 21.1125 10.5958 20.4875 11.4375C19.8625 12.2792 19.1333 13.0167 18.3 13.65ZM18.8 19.8L14.6 15.65C14.0167 15.8333 13.4292 15.9708 12.8375 16.0625C12.2458 16.1542 11.6333 16.2 11 16.2C8.48333 16.2 6.24167 15.5042 4.275 14.1125C2.30833 12.7208 0.883333 10.9167 0 8.7C0.35 7.81667 0.791667 6.99583 1.325 6.2375C1.85833 5.47917 2.46667 4.8 3.15 4.2L0.4 1.4L1.8 0L20.2 18.4L18.8 19.8ZM4.55 5.6C4.06667 6.03333 3.625 6.50833 3.225 7.025C2.825 7.54167 2.48333 8.1 2.2 8.7C3.03333 10.3833 4.22917 11.7208 5.7875 12.7125C7.34583 13.7042 9.08333 14.2 11 14.2C11.3333 14.2 11.6583 14.1792 11.975 14.1375C12.2917 14.0958 12.6167 14.05 12.95 14L12.05 13.05C11.8667 13.1 11.6917 13.1375 11.525 13.1625C11.3583 13.1875 11.1833 13.2 11 13.2C9.75 13.2 8.6875 12.7625 7.8125 11.8875C6.9375 11.0125 6.5 9.95 6.5 8.7C6.5 8.51667 6.5125 8.34167 6.5375 8.175C6.5625 8.00833 6.6 7.83333 6.65 7.65L4.55 5.6Z"
      fill="currentColor"
    />
  </svg>
);

const EyeIcon = () => (
  <svg
    className="h-[18px] w-[22.5px] cursor-pointer text-[#767683] transition-colors hover:text-gray-600"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

const Login = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Only a same-site relative path is accepted — a leading "//" parses as a
  // protocol-relative URL to an attacker-controlled host, and checkout/
  // appointments/wishlist all only ever pass an in-app path here anyway.
  const redirectParam = searchParams.get('redirect');
  const destination =
    redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
      ? redirectParam
      : '/';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const { session } = await api.auth.login({ email, password });
      if (session) {
        await supabase.auth.setSession({
          access_token: session.accessToken,
          refresh_token: session.refreshToken,
        });
        router.push(destination);
        router.refresh();
      }
    } catch (err) {
      setError(err.message || 'Invalid login credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#F9F9FC] px-[54px] pb-[162px] pt-[95px]">
      <div className="mb-[36px] flex w-full max-w-[504px] flex-col items-center gap-[7.88px] text-center">
        <Link href="/">
          <Image
            src="/images/Logo.png"
            alt="Optex"
            width={112}
            height={93}
            priority
            className="h-[93px] w-[112px] object-contain"
          />
        </Link>
        <p
          className="text-[#464652]"
          style={{
            fontFamily: 'Manrope, sans-serif',
            fontSize: '18px',
            lineHeight: '28.8px',
            fontWeight: 400,
          }}
        >
          Sign in to your account
        </p>
      </div>

      <div
        className="w-full max-w-[504px] rounded-[54px] bg-white px-[36px] pb-[36px] pt-[43.86px]"
        style={{ boxShadow: '0px 11.25px 33.75px 0px rgba(45, 50, 140, 0.08)' }}
      >
        {/* F-16: role="alert" so the failure is ANNOUNCED, not just shown. */}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600"
          >
            {error}
          </div>
        )}

        <form
          className="mx-auto flex w-full max-w-[432px] flex-col gap-[27px]"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-[9px]">
            <label
              htmlFor="login-email"
              className="text-[#1A1C1E]"
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: '15.75px',
                lineHeight: '18.9px',
                fontWeight: 700,
                letterSpacing: '0.79px',
              }}
            >
              Email Address
            </label>
            <div className="relative flex h-[58.28px] items-center">
              <div className="absolute left-[18px]">
                <MailIcon />
              </div>
              <input
                id="login-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-full w-full border-[1.13px] border-[#E8E8EA] bg-[#F9F9FC] pl-[49.5px] pr-[18px] text-[#1A1C1E] outline-none transition-colors focus:border-[#2A3182] focus:bg-white"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '18px',
                  lineHeight: '100%',
                  fontWeight: 400,
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-[9px]">
            <div className="flex h-[18.9px] items-center justify-between">
              <label
                htmlFor="login-password"
                className="text-[#1A1C1E]"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '15.75px',
                  lineHeight: '18.9px',
                  fontWeight: 700,
                  letterSpacing: '0.79px',
                }}
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[#141776] hover:underline"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '13.5px',
                  lineHeight: '16.2px',
                  fontWeight: 500,
                }}
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative flex h-[58.28px] items-center">
              <div className="absolute left-[18px]">
                <LockIcon />
              </div>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-full w-full border-[1.13px] border-[#E8E8EA] bg-[#F9F9FC] pl-[49.5px] pr-[49.5px] text-[#1A1C1E] outline-none transition-colors focus:border-[#2A3182] focus:bg-white"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '18px',
                  lineHeight: '100%',
                  fontWeight: 400,
                }}
              />
              <button
                type="button"
                className="absolute right-[18px]"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-[55.125px] w-full items-center justify-center rounded-[11248px] bg-[#141776] text-white transition-colors hover:bg-[#2A3182] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: '15.75px',
              fontWeight: 700,
              letterSpacing: '0.79px',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>

      <div className="mt-[36px] flex items-center justify-center gap-[4.49px]">
        <p
          className="text-[#464652]"
          style={{
            fontFamily: 'Manrope, sans-serif',
            fontSize: '18px',
            lineHeight: '28.8px',
            fontWeight: 400,
          }}
        >
          Don't have an account?
        </p>
        <Link
          href="/signup"
          className="text-[#141776] hover:underline"
          style={{
            fontFamily: 'Manrope, sans-serif',
            fontSize: '15.75px',
            lineHeight: '18.9px',
            fontWeight: 700,
            letterSpacing: '0.79px',
          }}
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}
