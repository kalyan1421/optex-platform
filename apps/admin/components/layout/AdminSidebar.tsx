'use client'

import { LayoutDashboard, Package, ShoppingCart, Users, BarChart3, LogOut, Boxes, CalendarCheck, FileText, Star, Tag, MapPin, CreditCard, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createBrowserSupabase } from '@optex/db/browser'

const lowStockCount = 3

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
    ],
  },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const db = createBrowserSupabase()
    await db.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col overflow-y-auto">
      <div className="border-b border-gray-200 shrink-0 px-3 py-3">
        <img
          alt="Optex Opticians Ltd"
          src="/images/Logo.png"
          className="w-full h-auto object-contain"
        />
      </div>

      <nav className="flex-1 p-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon
                const href = '/' + item.id
                const isActive = pathname === href || pathname.startsWith(href + '/')
                const showBadge = item.badge === 'lowStock' && lowStockCount > 0
                return (
                  <Link
                    key={item.id}
                    href={href}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      isActive
                        ? 'bg-[#141776] text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    {showBadge && (
                      <span className={cn(
                        'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium',
                        isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'
                      )}>
                        <AlertTriangle className="w-3 h-3" />
                        {lowStockCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 shrink-0">
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm">
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}
