'use client';

/**
 * Sub-navigation across the five inventory surfaces (CR-01 R2 sub-phase 2e).
 *
 * These are sibling routes under `/inventory` rather than top-level ones so
 * they inherit the existing `inventory.read` gate from `ROUTE_PERMISSIONS`
 * (`routeSegment()` keys off the first path segment) and need no new sidebar
 * entry. Read access is therefore uniform; it is the *writes* on each page
 * that carry their own `inventory.receive` / `.transfer` / `.adjust` /
 * `.count` permission, mirroring the API's per-route decorators.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Boxes,
  PackagePlus,
  ArrowLeftRight,
  SlidersHorizontal,
  ClipboardCheck,
  Truck,
} from 'lucide-react';
import { useCurrentUser } from '@/lib/user-context';

const TABS = [
  { href: '/inventory', label: 'Stock Levels', Icon: Boxes, permission: 'inventory.read' },
  {
    href: '/inventory/receiving',
    label: 'Receiving',
    Icon: PackagePlus,
    permission: 'inventory.receive',
  },
  {
    href: '/inventory/transfers',
    label: 'Transfers',
    Icon: ArrowLeftRight,
    permission: 'inventory.transfer',
  },
  {
    href: '/inventory/adjustments',
    label: 'Adjustments',
    Icon: SlidersHorizontal,
    permission: 'inventory.adjust',
  },
  {
    href: '/inventory/counts',
    label: 'Stock Counts',
    Icon: ClipboardCheck,
    permission: 'inventory.count',
  },
  // Not an `inventory.*` permission: supplier management is its own grant, and
  // a role can hold `inventory.receive` without it.
  {
    href: '/inventory/suppliers',
    label: 'Suppliers',
    Icon: Truck,
    permission: 'suppliers.manage',
  },
];

export function InventoryNav() {
  const pathname = usePathname();
  const { hasPermission, ready } = useCurrentUser();

  // Render nothing until permissions land, rather than flashing the full set
  // and then removing tabs the caller cannot use.
  if (!ready) return <div className="h-9" />;

  const visible = TABS.filter((t) => hasPermission(t.permission));

  return (
    <nav aria-label="Inventory sections" className="flex flex-wrap gap-2">
      {visible.map(({ href, label, Icon }) => {
        // `/inventory` would otherwise match every child route.
        const active = href === '/inventory' ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-[#141776] text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
