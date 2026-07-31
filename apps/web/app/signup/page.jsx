'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@optex/db/browser';
import { api } from '../../lib/api';

const UserIcon = () => (
  <svg
    className="h-5 w-5 text-gray-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

const MailIcon = () => (
  <svg
    className="h-5 w-5 text-gray-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const LockIcon = () => (
  <svg
    className="h-5 w-5 text-gray-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    className="h-5 w-5 cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
    />
  </svg>
);

const EyeIcon = () => (
  <svg
    className="h-5 w-5 cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
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

const HistoryIcon = () => (
  <svg
    className="h-5 w-5 text-gray-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const AppleIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.05 2.78.72 3.4 1.8-3.02 1.74-2.48 5.75.52 7 1.48-1.58 3.04-3.8 3.04-3.8-.75 2.4-1.54 4.54-2.53 6.01-.89 1.34-1.78 2.08-3.08 2.08zm-5.23-14.2c-.08-1.63.78-3.26 2.07-4.08.38 1.94-.84 3.48-2.07 4.08z" />
  </svg>
);

const Signup = () => {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }
    try {
      setLoading(true);
      const { session } = await api.auth.signup({
        email,
        password,
        fullName: name,
      });

      if (session) {
        await supabase.auth.setSession({
          access_token: session.accessToken,
          refresh_token: session.refreshToken,
        });
        setSuccess('Account created! Logging you in...');
        setTimeout(() => {
          router.push('/profile');
        }, 1000);
      } else {
        setSuccess('Account created! Please check your email to confirm.');
      }
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f9fa] px-4 py-10 sm:px-6 sm:py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <Link href="/">
          <Image
            src="/images/Logo.png"
            alt="Optex"
            width={120}
            height={60}
            className="mb-4 h-[60px] w-auto object-contain"
          />
        </Link>
        <p className="text-[15px] font-medium text-gray-500">Create your account</p>
      </div>

      <div className="w-full max-w-[480px] rounded-[28px] bg-white p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] sm:rounded-[32px] sm:p-8 lg:p-10">
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-[24px] font-black text-[#2A3182]">Create Account</h2>
          <p className="px-4 text-[13px] font-medium text-gray-500">
            Join our vision community for personalized eye care.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-[13px] font-medium text-green-700">
            {success}
          </div>
        )}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-[13px] font-bold text-[#1a1a1a]">Full Name</label>
            <div className="relative flex items-center">
              <div className="absolute left-4">
                <UserIcon />
              </div>
              <input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-2xl border border-gray-100 bg-[#f8f9fa] py-3.5 pl-12 pr-4 text-[14px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-bold text-[#1a1a1a]">Email Address</label>
            <div className="relative flex items-center">
              <div className="absolute left-4">
                <MailIcon />
              </div>
              <input
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-2xl border border-gray-100 bg-[#f8f9fa] py-3.5 pl-12 pr-4 text-[14px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-bold text-[#1a1a1a]">Password</label>
            <div className="relative flex items-center">
              <div className="absolute left-4">
                <LockIcon />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-2xl border border-gray-100 bg-[#f8f9fa] py-3.5 pl-12 pr-12 text-[14px] tracking-widest text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white"
              />
              <button
                type="button"
                className="absolute right-4"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-bold text-[#1a1a1a]">
              Confirm Password
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-4">
                <HistoryIcon />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-2xl border border-gray-100 bg-[#f8f9fa] py-3.5 pl-12 pr-12 text-[14px] tracking-widest text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white"
              />
              <button
                type="button"
                className="absolute right-4"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide' : 'Show'}
              >
                {showConfirmPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
          </div>

          <div className="mb-2 mt-1 flex items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-[#2A3182] focus:ring-[#2A3182]"
            />
            <p className="text-[12px] font-medium leading-relaxed text-gray-500">
              I agree to the{' '}
              <a href="/terms" className="text-[#2A3182] hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-[#2A3182] hover:underline">
                Privacy Policy
              </a>
              .
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !!success}
            className="w-full rounded-full bg-[#1a1a5c] py-4 text-[15px] font-bold text-white transition-colors hover:bg-[#2A3182] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-[13px] font-medium text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-[#2A3182] hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default function Page() {
  return <Signup />;
}
