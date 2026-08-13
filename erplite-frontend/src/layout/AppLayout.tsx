/**
 * src/layout/AppLayout.tsx
 *
 * Mobile-first responsive layout:
 *   - Desktop (md+): fixed sidebar on the right (RTL), always visible
 *   - Mobile (<md): sidebar is a slide-in drawer toggled by a hamburger button
 *
 * The header bar shows the app name, current page context, and a logout
 * button — visible on all breakpoints so users can always log out without
 * opening the drawer.
 *
 * Nav items are grouped by module so the sidebar stays scannable even with
 * ~16 entries.
 */
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/auth-state'

interface NavGroup {
  group: string
  items: { to: string; label: string; end?: boolean }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'الرئيسية',
    items: [{ to: '/', label: 'لوحة المتابعة', end: true }],
  },
  {
    group: 'المبيعات',
    items: [
      { to: '/sales/customers', label: 'العملاء' },
      { to: '/sales/orders', label: 'أوامر البيع' },
      { to: '/sales/invoices', label: 'فواتير المبيعات' },
      { to: '/sales/receipts', label: 'سندات القبض' },
    ],
  },
  {
    group: 'المشتريات',
    items: [
      { to: '/purchasing/suppliers', label: 'الموردون' },
      { to: '/purchasing/orders', label: 'أوامر الشراء' },
      { to: '/purchasing/invoices', label: 'فواتير المشتريات' },
      { to: '/purchasing/payments', label: 'سندات الصرف' },
    ],
  },
  {
    group: 'المخزون',
    items: [
      { to: '/inventory/items', label: 'الأصناف' },
      { to: '/inventory/categories', label: 'فئات الأصناف' },
      { to: '/inventory/warehouses', label: 'المخازن' },
      { to: '/inventory/stock-balance', label: 'رصيد المخزون' },
      { to: '/inventory/stock-movements', label: 'حركات المخزون' },
    ],
  },
  {
    group: 'المالية',
    items: [
      { to: '/finance/cash-bank', label: 'النقد والبنوك' },
      { to: '/finance/receivables', label: 'الذمم المدينة' },
      { to: '/finance/payables', label: 'الذمم الدائنة' },
    ],
  },
  {
    group: 'المحاسبة',
    items: [
      { to: '/accounting/accounts', label: 'شجرة الحسابات' },
      { to: '/accounting/journal-entries', label: 'القيود اليومية' },
      { to: '/accounting/trial-balance', label: 'ميزان المراجعة' },
    ],
  },
  {
    group: 'التقارير',
    items: [
      { to: '/reports', label: 'مركز التقارير' },
      { to: '/reports/sales', label: 'تقارير المبيعات' },
      { to: '/reports/purchasing', label: 'تقارير المشتريات' },
      { to: '/reports/inventory', label: 'تقارير المخزون' },
      { to: '/reports/accounting', label: 'التقارير المحاسبية' },
    ],
  },
  {
    group: 'الإعدادات',
    items: [
      { to: '/settings', label: 'الإعدادات' },
      { to: '/settings/reference', label: 'البيانات المرجعية' },
      { to: '/settings/fiscal', label: 'السنوات المالية' },
      { to: '/settings/payment-terms', label: 'شروط السداد' },
      { to: '/settings/tax-rates', label: 'الضرائب' },
      { to: '/settings/cost-centers', label: 'مراكز التكلفة' },
    ],
  },
]

export function AppLayout() {
  const { logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-gray-50" dir="rtl">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="hidden md:flex w-64 bg-white border-l shrink-0 flex-col">
        <Brand />
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {NAV_GROUPS.map((g) => (
            <NavGroup key={g.group} group={g} />
          ))}
        </nav>
        <LogoutButton onClick={logout} />
      </aside>

      {/* ---------- Mobile drawer ---------- */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative bg-white w-72 max-w-[80vw] h-full flex flex-col border-l shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700 text-xl"
                aria-label="إغلاق القائمة"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
              {NAV_GROUPS.map((g) => (
                <NavGroup
                  key={g.group}
                  group={g}
                  onNavigate={() => setDrawerOpen(false)}
                />
              ))}
            </nav>
            <LogoutButton
              onClick={() => {
                setDrawerOpen(false)
                logout()
              }}
            />
          </aside>
        </div>
      )}

      {/* ---------- Main column ---------- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between bg-white border-b px-4 py-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
            aria-label="فتح القائمة"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-bold text-gray-800">ERP Lite</span>
          <button
            type="button"
            onClick={logout}
            className="text-xs text-rose-600 px-2 py-1 hover:bg-rose-50 rounded-md"
          >
            خروج
          </button>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Brand() {
  return (
    <div className="p-4 border-b">
      <div className="text-lg font-bold text-gray-800">ERP Lite</div>
      <div className="text-xs text-gray-400">نظام إدارة موارد المؤسسات</div>
    </div>
  )
}

function NavGroup({
  group,
  onNavigate,
}: {
  group: NavGroup
  onNavigate?: () => void
}) {
  return (
    <div>
      <div className="px-2 text-xs text-gray-400 font-medium mb-1">{group.group}</div>
      <div className="space-y-1">
        {group.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `block px-3 py-1.5 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

function LogoutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="m-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-md text-right border-t border-gray-100 pt-3"
    >
      تسجيل الخروج
    </button>
  )
}
