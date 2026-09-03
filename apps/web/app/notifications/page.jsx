'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'order', label: 'Orders' },
  { key: 'appointment', label: 'Appointments' },
  { key: 'offer', label: 'Offers' },
];

const CATEGORY_ICON_BG = {
  order: 'bg-[#2A3182]/10 text-[#2A3182]',
  appointment: 'bg-emerald-50 text-emerald-600',
  offer: 'bg-[#E53935]/10 text-[#E53935]',
};

function BagIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 11H4L5 9z"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.59 13.41L11 3.83A2 2 0 009.59 3.24L4 3a1 1 0 00-1 1l.24 5.59a2 2 0 00.59 1.41l9.58 9.58a2 2 0 002.83 0l4.35-4.35a2 2 0 000-2.82z"
      />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BellSlashIcon() {
  return (
    <svg
      className="h-10 w-10 text-[#D4D4D4]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.66V5a2 2 0 10-4 0v.34a6 6 0 00-1.44.58M4 4l16 16M9 17v1a3 3 0 006 0v-1"
      />
    </svg>
  );
}

const CATEGORY_ICON = { order: BagIcon, appointment: CalendarIcon, offer: TagIcon };

/** "3h ago", "2d ago", falling back to a plain date past a week. */
function relativeTime(iso) {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();

  const [category, setCategory] = useState('all');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(
    (pageToLoad, cat) => {
      if (!user) return;
      const setBusy = pageToLoad === 1 ? setLoading : setLoadingMore;
      setBusy(true);
      api.notifications
        .list({ page: pageToLoad, pageSize: 20, ...(cat !== 'all' ? { category: cat } : {}) })
        .then((res) => {
          setItems((prev) => (pageToLoad === 1 ? res.data : [...prev, ...res.data]));
          setPage(res.page);
          setTotalPages(res.totalPages);
          setError('');
        })
        .catch((err) => {
          console.error('Notifications load error:', err);
          setError('We could not load your notifications. Please try again.');
        })
        .finally(() => setBusy(false));
    },
    [user],
  );

  useEffect(() => {
    if (!authLoading) load(1, category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, category]);

  async function handleOpen(item) {
    if (!item.readAt) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)),
      );
      try {
        await api.notifications.markRead(item.id);
      } catch (err) {
        console.error('Mark notification read error:', err);
      }
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await api.notifications.markAllRead();
      setItems((prev) =>
        prev.map((i) => (i.readAt ? i : { ...i, readAt: new Date().toISOString() })),
      );
    } catch (err) {
      console.error('Mark all read error:', err);
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = items.filter((i) => !i.readAt).length;

  return (
    <div className="mx-auto w-full max-w-[860px] px-6 py-10 lg:py-[60px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-poppins text-[28px] font-bold text-[#0A0A0A] lg:text-[36px]">
            Notifications
          </h1>
          <p className="font-inter mt-2 text-[#717182]">
            {!authLoading && user
              ? 'Updates on your orders, appointments, and offers.'
              : 'Sign in to see your notifications.'}
          </p>
        </div>
        {user && unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="font-inter shrink-0 rounded-full border border-[#E5E7EB] px-5 py-2.5 text-[13px] font-bold text-[#2A3182] transition-colors hover:border-[#2A3182] disabled:opacity-50"
          >
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </button>
        )}
      </div>

      {!authLoading && !user && (
        <div className="mt-8 flex flex-col items-center justify-center rounded-[32px] border-[0.8px] border-[#D4D4D4] px-6 py-[80px] text-center">
          <p className="font-inter mb-[24px] max-w-[420px] text-[16px] text-[#717182]">
            Your notification feed is tied to your account.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent('/notifications')}`}
            className="font-inter flex h-[44px] items-center justify-center rounded-[26843500px] bg-[#2A3182] px-[28px] text-[15px] font-semibold text-white transition-colors hover:bg-[#1e2361]"
          >
            Sign in
          </Link>
        </div>
      )}

      {user && (
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`font-inter shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
                category === c.key
                  ? 'bg-[#2A3182] text-white'
                  : 'border border-[#E5E7EB] text-[#717182] hover:border-[#2A3182]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[14px] font-medium text-red-600"
        >
          {error}
        </div>
      )}

      {user && loading && (
        <div className="mt-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse gap-4 rounded-[20px] border border-[#E5E7EB] p-4"
            >
              <div className="h-10 w-10 shrink-0 rounded-full bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-gray-100" />
                <div className="h-3 w-1/3 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {user && !loading && items.length === 0 && !error && (
        <div className="mt-8 flex flex-col items-center justify-center rounded-[32px] border-[0.8px] border-[#D4D4D4] px-6 py-[80px] text-center">
          <BellSlashIcon />
          <h2 className="font-poppins mb-[8px] mt-4 text-[22px] font-semibold text-[#0A0A0A]">
            Nothing here yet
          </h2>
          <p className="font-inter max-w-[420px] text-[16px] text-[#717182]">
            Updates on your orders, appointments, and offers will show up here.
          </p>
        </div>
      )}

      {user && !loading && items.length > 0 && (
        <ul className="mt-6 space-y-3">
          {items.map((item) => {
            const Icon = CATEGORY_ICON[item.category] ?? BagIcon;
            const unread = !item.readAt;
            const content = (
              <div
                className={`flex gap-4 rounded-[20px] border p-4 transition-colors ${
                  unread ? 'border-[#2A3182]/20 bg-[#2A3182]/5' : 'border-[#E5E7EB] bg-white'
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${CATEGORY_ICON_BG[item.category] ?? 'bg-gray-100 text-gray-500'}`}
                >
                  <Icon />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className={`font-poppins text-[14px] ${unread ? 'font-bold text-[#0A0A0A]' : 'font-semibold text-[#3a3a3a]'}`}
                    >
                      {item.title}
                    </p>
                    {unread && (
                      <span
                        aria-label="Unread"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#E53935]"
                      />
                    )}
                  </div>
                  <p className="font-inter mt-1 text-[13px] text-[#717182]">{item.body}</p>
                  <p className="font-inter mt-2 text-[11px] uppercase tracking-wide text-[#A3A3A3]">
                    {relativeTime(item.createdAt)}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={item.id}>
                {item.link ? (
                  <Link href={item.link} onClick={() => handleOpen(item)} className="block">
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpen(item)}
                    className="block w-full text-left"
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {user && !loading && page < totalPages && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => load(page + 1, category)}
            disabled={loadingMore}
            className="font-inter rounded-full border border-[#E5E7EB] px-6 py-2.5 text-[13px] font-bold text-[#2A3182] transition-colors hover:border-[#2A3182] disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
