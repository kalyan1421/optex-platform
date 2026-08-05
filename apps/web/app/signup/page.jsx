'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@optex/db/browser';
import { api } from '../../lib/api';

const UserIcon = () => (
  <svg className="lg:w-[16px] lg:h-[16px] w-[18px] h-[18px] text-[#767683]" fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 8C6.9 8 5.95833 7.60833 5.175 6.825C4.39167 6.04167 4 5.1 4 4C4 2.9 4.39167 1.95833 5.175 1.175C5.95833 0.391667 6.9 0 8 0C9.1 0 10.0417 0.391667 10.825 1.175C11.6083 1.95833 12 2.9 12 4C12 5.1 11.6083 6.04167 10.825 6.825C10.0417 7.60833 9.1 8 8 8ZM0 16V13.2C0 12.6333 0.145833 12.1125 0.4375 11.6375C0.729167 11.1625 1.11667 10.8 1.6 10.55C2.63333 10.0333 3.68333 9.64583 4.75 9.3875C5.81667 9.12917 6.9 9 8 9C9.1 9 10.1833 9.12917 11.25 9.3875C12.3167 9.64583 13.3667 10.0333 14.4 10.55C14.8833 10.8 15.2708 11.1625 15.5625 11.6375C15.8542 12.1125 16 12.6333 16 13.2V16H0ZM2 14H14V13.2C14 13.0167 13.9542 12.85 13.8625 12.7C13.7708 12.55 13.65 12.4333 13.5 12.35C12.6 11.9 11.6917 11.5625 10.775 11.3375C9.85833 11.1125 8.93333 11 8 11C7.06667 11 6.14167 11.1125 5.225 11.3375C4.30833 11.5625 3.4 11.9 2.5 12.35C2.35 12.4333 2.22917 12.55 2.1375 12.7C2.04583 12.85 2 13.0167 2 13.2V14ZM8 6C8.55 6 9.02083 5.80417 9.4125 5.4125C9.80417 5.02083 10 4.55 10 4C10 3.45 9.80417 2.97917 9.4125 2.5875C9.02083 2.19583 8.55 2 8 2C7.45 2 6.97917 2.19583 6.5875 2.5875C6.19583 2.97917 6 3.45 6 4C6 4.55 6.19583 5.02083 6.5875 5.4125C6.97917 5.80417 7.45 6 8 6Z" fill="currentColor"/>
  </svg>
);

const MailIcon = () => (
  <svg className="lg:w-[20px] lg:h-[16px] w-[18px] h-[18px] text-[#767683]" fill="none" viewBox="0 0 20 16" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 16C1.45 16 0.979167 15.8042 0.5875 15.4125C0.195833 15.0208 0 14.55 0 14V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H18C18.55 0 19.0208 0.195833 19.4125 0.5875C19.8042 0.979167 20 1.45 20 2V14C20 14.55 19.8042 15.0208 19.4125 15.4125C19.0208 15.8042 18.55 16 18 16H2ZM10 9L2 4V14H18V4L10 9ZM10 7L18 2H2L10 7ZM2 4V2V4V14V4Z" fill="currentColor"/>
  </svg>
);

const LockIcon = () => (
  <svg className="lg:w-[16px] lg:h-[21px] w-[18px] h-[23.625px] text-[#767683]" fill="none" viewBox="0 0 16 21" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 21C1.45 21 0.979167 20.8042 0.5875 20.4125C0.195833 20.0208 0 19.55 0 19V9C0 8.45 0.195833 7.97917 0.5875 7.5875C0.979167 7.19583 1.45 7 2 7H3V5C3 3.61667 3.4875 2.4375 4.4625 1.4625C5.4375 0.4875 6.61667 0 8 0C9.38333 0 10.5625 0.4875 11.5375 1.4625C12.5125 2.4375 13 3.61667 13 5V7H14C14.55 7 15.0208 7.19583 15.4125 7.5875C15.8042 7.97917 16 8.45 16 9V19C16 19.55 15.8042 20.0208 15.4125 20.4125C15.0208 20.8042 14.55 21 14 21H2ZM2 19H14V9H2V19ZM8 16C8.55 16 9.02083 15.8042 9.4125 15.4125C9.80417 15.0208 10 14.55 10 14C10 13.45 9.80417 12.9792 9.4125 12.5875C9.02083 12.1958 8.55 12 8 12C7.45 12 6.97917 12.1958 6.5875 12.5875C6.19583 12.9792 6 13.45 6 14C6 14.55 6.19583 15.0208 6.5875 15.4125C6.97917 15.8042 7.45 16 8 16ZM5 7H11V5C11 4.16667 10.7083 3.45833 10.125 2.875C9.54167 2.29167 8.83333 2 8 2C7.16667 2 6.45833 2.29167 5.875 2.875C5.29167 3.45833 5 4.16667 5 5V7ZM2 19V9V19Z" fill="currentColor"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg className="lg:w-[22px] lg:h-[20px] w-[24.75px] h-[22.27px] cursor-pointer text-[#767683] transition-colors hover:text-gray-600" fill="none" viewBox="0 0 22 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.1 10.5L13.65 9.05C13.8 8.26667 13.575 7.53333 12.975 6.85C12.375 6.16667 11.6 5.9 10.65 6.05L9.2 4.6C9.48333 4.46667 9.77083 4.36667 10.0625 4.3C10.3542 4.23333 10.6667 4.2 11 4.2C12.25 4.2 13.3125 4.6375 14.1875 5.5125C15.0625 6.3875 15.5 7.45 15.5 8.7C15.5 9.03333 15.4667 9.34583 15.4 9.6375C15.3333 9.92917 15.2333 10.2167 15.1 10.5ZM18.3 13.65L16.85 12.25C17.4833 11.7667 18.0458 11.2375 18.5375 10.6625C19.0292 10.0875 19.45 9.43333 19.8 8.7C18.9667 7.01667 17.7708 5.67917 16.2125 4.6875C14.6542 3.69583 12.9167 3.2 11 3.2C10.5167 3.2 10.0417 3.23333 9.575 3.3C9.10833 3.36667 8.65 3.46667 8.2 3.6L6.65 2.05C7.33333 1.76667 8.03333 1.55417 8.75 1.4125C9.46667 1.27083 10.2167 1.2 11 1.2C13.5167 1.2 15.7583 1.89583 17.725 3.2875C19.6917 4.67917 21.1167 6.48333 22 8.7C21.6167 9.68333 21.1125 10.5958 20.4875 11.4375C19.8625 12.2792 19.1333 13.0167 18.3 13.65ZM18.8 19.8L14.6 15.65C14.0167 15.8333 13.4292 15.9708 12.8375 16.0625C12.2458 16.1542 11.6333 16.2 11 16.2C8.48333 16.2 6.24167 15.5042 4.275 14.1125C2.30833 12.7208 0.883333 10.9167 0 8.7C0.35 7.81667 0.791667 6.99583 1.325 6.2375C1.85833 5.47917 2.46667 4.8 3.15 4.2L0.4 1.4L1.8 0L20.2 18.4L18.8 19.8ZM4.55 5.6C4.06667 6.03333 3.625 6.50833 3.225 7.025C2.825 7.54167 2.48333 8.1 2.2 8.7C3.03333 10.3833 4.22917 11.7208 5.7875 12.7125C7.34583 13.7042 9.08333 14.2 11 14.2C11.3333 14.2 11.6583 14.1792 11.975 14.1375C12.2917 14.0958 12.6167 14.05 12.95 14L12.05 13.05C11.8667 13.1 11.6917 13.1375 11.525 13.1625C11.3583 13.1875 11.1833 13.2 11 13.2C9.75 13.2 8.6875 12.7625 7.8125 11.8875C6.9375 11.0125 6.5 9.95 6.5 8.7C6.5 8.51667 6.5125 8.34167 6.5375 8.175C6.5625 8.00833 6.6 7.83333 6.65 7.65L4.55 5.6Z" fill="currentColor"/>
  </svg>
);

const EyeIcon = () => (
  <svg className="w-[24.75px] h-[22.27px] cursor-pointer text-[#767683] transition-colors hover:text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const HistoryIcon = () => (
  <svg className="lg:w-[20px] lg:h-[20px] w-[22.5px] h-[22.5px] text-[#767683]" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 20C8.61667 20 7.31667 19.7375 6.1 19.2125C4.88333 18.6875 3.825 17.975 2.925 17.075C2.025 16.175 1.3125 15.1167 0.7875 13.9C0.2625 12.6833 0 11.3833 0 10H2C2 11.1 2.20833 12.1375 2.625 13.1125C3.04167 14.0875 3.6125 14.9375 4.3375 15.6625C5.0625 16.3875 5.9125 16.9625 6.8875 17.3875C7.8625 17.8125 8.9 18.025 10 18.025C12.2333 18.025 14.125 17.25 15.675 15.7C17.225 14.15 18 12.2583 18 10.025C18 7.79167 17.225 5.9 15.675 4.35C14.125 2.8 12.2333 2.025 10 2.025C8.51667 2.025 7.17083 2.3875 5.9625 3.1125C4.75417 3.8375 3.8 4.8 3.1 6H6V8H0V2H2V4C2.91667 2.78333 4.06667 1.8125 5.45 1.0875C6.83333 0.3625 8.35 0 10 0C11.3833 0 12.6833 0.2625 13.9 0.7875C15.1167 1.3125 16.175 2.025 17.075 2.925C17.975 3.825 18.6875 4.88333 19.2125 6.1C19.7375 7.31667 20 8.61667 20 10C20 11.3833 19.7375 12.6833 19.2125 13.9C18.6875 15.1167 17.975 16.175 17.075 17.075C16.175 17.975 15.1167 18.6875 13.9 19.2125C12.6833 19.7375 11.3833 20 10 20ZM8 14C7.71667 14 7.47917 13.9042 7.2875 13.7125C7.09583 13.5208 7 13.2833 7 13V10C7 9.71667 7.09583 9.47917 7.2875 9.2875C7.47917 9.09583 7.71667 9 8 9V8C8 7.45 8.19583 6.97917 8.5875 6.5875C8.97917 6.19583 9.45 6 10 6C10.55 6 11.0208 6.19583 11.4125 6.5875C11.8042 6.97917 12 7.45 12 8V9C12.2833 9 12.5208 9.09583 12.7125 9.2875C12.9042 9.47917 13 9.71667 13 10V13C13 13.2833 12.9042 13.5208 12.7125 13.7125C12.5208 13.9042 12.2833 14 12 14H8ZM9 9H11V8C11 7.71667 10.9042 7.47917 10.7125 7.2875C10.5208 7.09583 10.2833 7 10 7C9.71667 7 9.47917 7.09583 9.2875 7.2875C9.09583 7.47917 9 7.71667 9 8V9Z" fill="currentColor"/>
  </svg>
);

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const AppleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="#000000" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.62-1.491 3.601-2.937 1.13-1.633 1.597-3.218 1.621-3.303-.035-.015-3.091-1.186-3.118-4.717-.025-2.96 2.42-4.417 2.533-4.492-1.39-2.044-3.535-2.324-4.296-2.39-1.921-.194-3.943 1.139-4.922 1.139zm3.017-4.249c.842-1.013 1.408-2.425 1.253-3.834-1.213.048-2.678.809-3.538 1.815-.762.883-1.433 2.329-1.252 3.714 1.36.104 2.695-.678 3.537-1.695z"/>
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
    <div className="flex min-h-screen flex-col items-center bg-[#F9F9FC] pt-[95px] px-[54px] pb-[162px]">
      <div className="flex flex-col items-center text-center gap-[7.88px] w-full max-w-[504px] mb-[36px]">
        <Link href="/">
          <img src="/images/Logo.png" alt="Optex" className="w-[112px] h-[93px] object-contain" />
        </Link>
        <p className="text-[#464652]" style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', lineHeight: '28.8px', fontWeight: 400 }}>Sign in to your account</p>
      </div>

      <div 
        className="w-full max-w-[504px] rounded-[36px] bg-white pt-[43.88px] px-[45px] pb-[45px] border-[1.13px] border-[rgba(199,197,212,0.3)]"
        style={{ boxShadow: '0px 11.25px 33.75px 0px rgba(45, 50, 140, 0.08)' }}
      >
        <div className="mb-[34.88px] text-center w-full max-w-[411.75px] mx-auto flex flex-col gap-[7.65px]">
          <h2 className="text-[#141776]" style={{ fontFamily: 'Manrope, sans-serif', fontSize: '36px', lineHeight: '46.8px', fontWeight: 700 }}>Create Account</h2>
          <p className="text-[#464652]" style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', lineHeight: '28.8px', fontWeight: 400 }}>Join our vision community for personalized eye care.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600 w-full max-w-[411.75px] mx-auto">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-[13px] font-medium text-green-700 w-full max-w-[411.75px] mx-auto">
            {success}
          </div>
        )}

        <form className="flex flex-col gap-[25.88px] mx-auto w-full max-w-[411.75px]" onSubmit={handleSubmit}>
          
          <div className="flex flex-col gap-[5.4px]">
            <label className="text-[#1A1C1E]" style={{ fontFamily: 'Manrope, sans-serif', fontSize: '15.75px', lineHeight: '18.9px', fontWeight: 700, letterSpacing: '0.79px' }}>Full Name</label>
            <div className="relative flex items-center h-[56.5px]">
              <div className="absolute left-[18px]">
                <UserIcon />
              </div>
              <input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-full bg-[#F9F9FC] border-[1.13px] border-[#C7C5D4] rounded-[11248px] pl-[54px] pr-[18px] text-[#1A1C1E] outline-none focus:bg-white focus:border-[#2A3182] transition-colors"
                style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', lineHeight: '100%', fontWeight: 400 }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-[5.4px]">
            <label className="text-[#1A1C1E]" style={{ fontFamily: 'Manrope, sans-serif', fontSize: '15.75px', lineHeight: '18.9px', fontWeight: 700, letterSpacing: '0.79px' }}>Email Address</label>
            <div className="relative flex items-center h-[56.5px]">
              <div className="absolute left-[18px]">
                <MailIcon />
              </div>
              <input
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-full bg-[#F9F9FC] border-[1.13px] border-[#C7C5D4] rounded-[11248px] pl-[54px] pr-[18px] text-[#1A1C1E] outline-none focus:bg-white focus:border-[#2A3182] transition-colors"
                style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', lineHeight: '100%', fontWeight: 400 }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-[5.4px]">
            <label className="text-[#1A1C1E]" style={{ fontFamily: 'Manrope, sans-serif', fontSize: '15.75px', lineHeight: '18.9px', fontWeight: 700, letterSpacing: '0.79px' }}>Password</label>
            <div className="relative flex items-center h-[56.5px]">
              <div className="absolute left-[18px]">
                <LockIcon />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full h-full bg-[#F9F9FC] border-[1.13px] border-[#C7C5D4] rounded-[11248px] pl-[54px] pr-[54px] text-[#1A1C1E] tracking-widest outline-none focus:bg-white focus:border-[#2A3182] transition-colors"
                style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', lineHeight: '100%', fontWeight: 400 }}
              />
              <button type="button" className="absolute right-[18px]" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-[5.4px]">
            <label className="text-[#1A1C1E]" style={{ fontFamily: 'Manrope, sans-serif', fontSize: '15.75px', lineHeight: '18.9px', fontWeight: 700, letterSpacing: '0.79px' }}>Confirm Password</label>
            <div className="relative flex items-center h-[56.5px]">
              <div className="absolute left-[18px]">
                <HistoryIcon />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full h-full bg-[#F9F9FC] border-[1.13px] border-[#C7C5D4] rounded-[11248px] pl-[54px] pr-[54px] text-[#1A1C1E] tracking-widest outline-none focus:bg-white focus:border-[#2A3182] transition-colors"
                style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', lineHeight: '100%', fontWeight: 400 }}
              />
              <button type="button" className="absolute right-[18px]" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Hide' : 'Show'}>
                {showConfirmPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-[13.5px] pt-[1.13px] pb-[10.13px]">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-[2px] w-[22.5px] h-[22.5px] shrink-0 cursor-pointer rounded-[18px] border-[1.13px] border-[#C7C5D4] bg-[#F9F9FC] checked:bg-[#141776] appearance-none flex items-center justify-center relative after:content-[''] after:absolute after:w-[6px] after:h-[10px] after:border-r-[2px] after:border-b-[2px] after:border-white after:rotate-45 after:-mt-[2px] after:opacity-0 checked:after:opacity-100"
            />
            <p className="pt-[2.25px] text-[#1A1C1E]" style={{ fontFamily: 'Manrope, sans-serif', fontSize: '15.75px', lineHeight: '22.5px', fontWeight: 400 }}>
              I agree to the <a href="#terms" className="underline hover:text-[#141776]">Terms of Service</a> and <a href="#privacy" className="underline hover:text-[#141776]">Privacy Policy</a>.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !!success}
            className="w-full h-[55.125px] flex items-center justify-center rounded-[11248px] bg-[#141776] text-white transition-colors hover:bg-[#2A3182] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: 'Manrope, sans-serif', fontSize: '15.75px', lineHeight: '18.9px', fontWeight: 700, letterSpacing: '0.79px' }}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="mt-[34.88px] flex items-center justify-center gap-[4.49px]">
          <p className="text-[#464652]" style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', lineHeight: '28.8px', fontWeight: 400 }}>Already have an account?</p>
          <Link href="/login" className="text-[#141776] underline" style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', lineHeight: '100%', fontWeight: 400 }}>Sign In</Link>
        </div>

      </div>
    </div>
  );
};

export default function Page() { return <Signup />; }
