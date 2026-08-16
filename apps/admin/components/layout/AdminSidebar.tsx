'use client';

import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  LogOut,
  Boxes,
  CalendarCheck,
  FileText,
  Star,
  Tag,
  MapPin,
  CreditCard,
  AlertTriangle,
  Ban,
  UserCog,
  ScrollText,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createBrowserSupabase } from '@optex/db/browser';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrentUser } from '@/lib/user-context';
import { ROUTE_PERMISSIONS } from '@/lib/route-permissions';

const lowStockCount = 3;

/**
 * Each `item.id` is looked up in `lib/route-permissions.ts`'s
 * `ROUTE_PERMISSIONS` map (CR-01 R1) to decide visibility — a single shared
 * map rather than a permission duplicated onto every item here, so it can't
 * drift out of sync with `PermissionGate` or the login redirect.
 */
const navGroups = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { id: 'products', label: 'Products', icon: Package },
      { id: 'inventory', label: 'Inventory', icon: Boxes, badge: 'lowStock' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'orders', label: 'Orders', icon: ShoppingCart },
      { id: 'appointments', label: 'Appointments', icon: CalendarCheck },
      { id: 'customers', label: 'Customers', icon: Users },
      { id: 'prescriptions', label: 'Prescriptions', icon: FileText },
      { id: 'cancellations', label: 'Cancellations', icon: Ban, badge: 'pendingCancellations' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { id: 'reviews', label: 'Reviews', icon: Star },
      { id: 'promotions', label: 'Promotions', icon: Tag },
    ],
  },
  {
    label: 'Settings',
    items: [
      { id: 'branches', label: 'Branches', icon: MapPin },
      { id: 'payments', label: 'Payments', icon: CreditCard },
      { id: 'staff', label: 'Staff', icon: UserCog },
      { id: 'audit-log', label: 'Audit Log', icon: ScrollText },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { hasPermission, ready } = useCurrentUser();

  // A real count, from the API — SPEC-06 R3 wants pending requests visible
  // without opening the screen, so nothing sits unanswered. Re-read on
  // navigation so deciding a request updates the badge.
  //
  // Gated on `cancellations.decide` — firing this for every role regardless
  // of whether they hold the permission would just be a guaranteed 403 on
  // every page view for Inventory Manager, Marketing, etc.
  const [pendingCancellations, setPendingCancellations] = useState(0);
  useEffect(() => {
    if (!ready || !hasPermission('cancellations.decide')) return;
    let cancelled = false;
    api.admin.cancellations
      .pendingCount()
      .then(({ count }) => {
        if (!cancelled) setPendingCancellations(count);
      })
      // A failed badge must never break the sidebar — it is decoration on a
      // navigation element every admin page renders.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, ready, hasPermission]);

  async function handleLogout() {
    const db = createBrowserSupabase();
    await db.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex h-screen w-64 flex-col overflow-y-auto border-r border-gray-200 bg-white">
      <div className="flex shrink-0 justify-center border-b border-gray-200 px-3 py-3">
        <img
          alt="Optex Opticians Ltd"
          src="/images/Logo.png"
          className="h-10 w-auto object-contain"
        />
      </div>

      <nav className="flex-1 space-y-6 p-4">
        {navGroups.map((group) => {
          // A permission not yet resolved (still loading) is treated as
          // "not held" — the sidebar starts empty and fills in once
          // `/auth/me` resolves, rather than flashing every item first.
          const visibleItems = group.items.filter((item) => {
            const permission = ROUTE_PERMISSIONS[item.id];
            return !permission || hasPermission(permission);
          });
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const href = '/' + item.id;
                  const isActive = pathname === href || pathname.startsWith(href + '/');
                  const badgeCount =
                    item.badge === 'lowStock'
                      ? lowStockCount
                      : item.badge === 'pendingCancellations'
                        ? pendingCancellations
                        : 0;
                  const showBadge = !!item.badge && badgeCount > 0;
                  return (
                    <Link
                      key={item.id}
                      href={href}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors',
                        isActive
                          ? 'bg-[#141776] text-white'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="text-sm">{item.label}</span>
                      </div>
                      {showBadge && (
                        <span
                          className={cn(
                            'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium',
                            isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600',
                          )}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-gray-200 p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
