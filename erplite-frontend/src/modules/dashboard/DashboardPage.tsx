/**
 * src/modules/dashboard/DashboardPage.tsx
 *
 * Real KPI dashboard built ONLY from existing backend endpoints.
 *
 * Sources (per `BACKEND_ARCHITECTURE.md` + endpoint inventory):
 *   - GET /reporting/dashboard-summary       → financial KPIs (sales/purchases/AR/AP this month)
 *                                              + counts (customers/suppliers/items/low-stock/pending)
 *   - GET /sales/sales-orders                → recent 10 sales orders
 *   - GET /purchasing/purchase-orders        → recent 10 purchase orders
 *   - GET /inventory/stock-balance           → total on-hand qty + low-stock count
 *
 * The /reporting/dashboard-summary endpoint was added during the autonomous
 * production-readiness pass — it aggregates data server-side using cheap
 * COUNT/SUM queries against RLS-protected tables (see
 * app/modules/reporting/router.py).
 */
import { useQueries } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { salesApi } from '../sales/api'
import { purchasingApi } from '../purchasing/api'
import { inventoryApi } from '../inventory/api'
import { reportingApi } from '../reporting/api'
import { StatusBadge } from '../../components/StatusBadge'
import { Card, Skeleton, EmptyState, ErrorState, PageHeader } from '../../components/ui'

function sortByDateDesc<T extends { document_date?: string; posting_date?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const da = a.document_date ?? a.posting_date ?? ''
    const db = b.document_date ?? b.posting_date ?? ''
    return db.localeCompare(da)
  })
}

export function DashboardPage() {
  // Run all the KPI queries in parallel — TanStack Query will batch + cache.
  // `staleTime: 60s` so navigating away and back doesn't refetch instantly.
  const [
    summaryQ,
    salesOrdersQ,
    purchaseOrdersQ,
    stockBalanceQ,
  ] = useQueries({
    queries: [
      { queryKey: ['dashboard-summary'], queryFn: () => reportingApi.getDashboardSummary(), staleTime: 60_000 },
      { queryKey: ['sales-orders'], queryFn: () => salesApi.listSalesOrders(), staleTime: 60_000 },
      { queryKey: ['purchase-orders'], queryFn: () => purchasingApi.listPurchaseOrders(), staleTime: 60_000 },
      { queryKey: ['stock-balance'], queryFn: () => inventoryApi.stockBalance(), staleTime: 60_000 },
    ],
  })

  // Surface ANY of the four query errors so partial failures don't go silent.
  // Order matters: prefer summary error (most critical for KPIs), then fall
  // through to the activity-list queries so the user sees *something* failed.
  const anyError = summaryQ.error ?? salesOrdersQ.error ?? purchaseOrdersQ.error ?? stockBalanceQ.error

  // Pull counts from the summary endpoint (single round-trip)
  const summary = summaryQ.data
  const customersCount = summary?.total_customers
  const suppliersCount = summary?.total_suppliers
  const itemsCount = summary?.total_items
  // Note: total counts of SO/PO come from the list queries (summary only gives pending counts).
  // The list queries are NOT filtered by date, so soTotal/poTotal are LIFETIME totals.
  const soTotal = salesOrdersQ.data?.length
  const poTotal = purchaseOrdersQ.data?.length
  const draftSO = summary?.pending_sales_orders ?? 0
  const draftPO = summary?.pending_purchase_orders ?? 0
  const draftJE = summary?.pending_journal_entries ?? 0
  // Note: do NOT derive "submitted = total - draft" because the totals are
  // lifetime counts while pending is a current-state count — the subtraction
  // would be meaningless. Just show the pending count.

  // Stock metrics derived from the stock-balance endpoint.
  const stockRows = stockBalanceQ.data ?? []
  const totalQtyOnHand = stockRows.reduce((s, r) => s + Number(r.qty_on_hand || 0), 0)
  const lowStockCount = summary?.items_low_stock ?? stockRows.filter((r) => Number(r.qty_on_hand) <= 0).length

  // Recent activity (last 10 of each)
  const recentSales = sortByDateDesc(salesOrdersQ.data ?? []).slice(0, 10)
  const recentPurchases = sortByDateDesc(purchaseOrdersQ.data ?? []).slice(0, 10)

  const fmtMoney = (n: number | undefined) =>
    n === undefined ? undefined : n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div>
      <PageHeader title="لوحة المتابعة" />

      {anyError && <div className="mb-4"><ErrorState error={anyError} /></div>}

      {/* ---------- Financial KPIs (from /reporting/dashboard-summary) ---------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiTile
          label="إجمالي المبيعات هذا الشهر"
          value={fmtMoney(summary?.total_sales_this_month)}
          available={summary !== undefined}
          tone="success"
        />
        <KpiTile
          label="إجمالي المشتريات هذا الشهر"
          value={fmtMoney(summary?.total_purchases_this_month)}
          available={summary !== undefined}
          tone="warning"
        />
        <KpiTile
          label="ذمم مدينة (عملاء)"
          value={fmtMoney(summary?.total_ar)}
          available={summary !== undefined}
          subtitle="Accounts Receivable"
        />
        <KpiTile
          label="ذمم دائنة (موردون)"
          value={fmtMoney(summary?.total_ap)}
          available={summary !== undefined}
          subtitle="Accounts Payable"
        />
      </div>

      {/* ---------- Master data KPIs (clickable) ---------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Link to="/sales/customers" className="block hover:scale-[1.02] transition-transform">
          <KpiTile label="العملاء" value={customersCount} available={customersCount !== undefined} subtitle="إجمالي العملاء" />
        </Link>
        <Link to="/purchasing/suppliers" className="block hover:scale-[1.02] transition-transform">
          <KpiTile label="الموردون" value={suppliersCount} available={suppliersCount !== undefined} subtitle="إجمالي الموردين" />
        </Link>
        <Link to="/inventory/items" className="block hover:scale-[1.02] transition-transform">
          <KpiTile label="الأصناف" value={itemsCount} available={itemsCount !== undefined} subtitle="إجمالي الأصناف" />
        </Link>
        <Link to="/inventory/stock-balance" className="block hover:scale-[1.02] transition-transform">
          <KpiTile
            label="إجمالي الكمية بالمخزن"
            value={totalQtyOnHand.toFixed(2)}
            available={stockBalanceQ.data !== undefined}
            subtitle={lowStockCount && lowStockCount > 0 ? `${lowStockCount} صنف برصيد منخفض` : undefined}
            tone={lowStockCount && lowStockCount > 0 ? 'warning' : 'success'}
          />
        </Link>
      </div>

      {/* ---------- Documents row ---------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Link to="/sales/orders" className="block hover:scale-[1.02] transition-transform">
          <KpiTile
            label="أوامر البيع"
            value={soTotal}
            available={soTotal !== undefined}
            subtitle={`بانتظار الاعتماد: ${draftSO}`}
          />
        </Link>
        <Link to="/purchasing/orders" className="block hover:scale-[1.02] transition-transform">
          <KpiTile
            label="أوامر الشراء"
            value={poTotal}
            available={poTotal !== undefined}
            subtitle={`بانتظار الاعتماد: ${draftPO}`}
          />
        </Link>
        <Link to="/accounting/journal-entries" className="block hover:scale-[1.02] transition-transform">
          <KpiTile
            label="قيود اليومية مسودة"
            value={draftJE}
            available={summary !== undefined}
            subtitle="قيد الاعتماد"
            tone={draftJE > 0 ? 'warning' : 'success'}
          />
        </Link>
        <Link to="/inventory/stock-balance" className="block hover:scale-[1.02] transition-transform">
          <KpiTile
            label="أصناف منخفضة المخزون"
            value={lowStockCount}
            available={summary !== undefined}
            subtitle="رصيد ≤ 0"
            tone={(lowStockCount ?? 0) > 0 ? 'danger' : 'success'}
          />
        </Link>
      </div>

      {/* ---------- Recent activity ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padded={false}>
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">آخر أوامر البيع</h2>
            <Link to="/sales/orders" className="text-xs text-blue-600 hover:underline">
              عرض الكل
            </Link>
          </div>
          {salesOrdersQ.isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : salesOrdersQ.error ? (
            <div className="p-3"><ErrorState error={salesOrdersQ.error} /></div>
          ) : recentSales.length === 0 ? (
            <EmptyState message="لا توجد أوامر بيع بعد" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-2 text-right font-medium">رقم الأمر</th>
                    <th className="p-2 text-right font-medium">التاريخ</th>
                    <th className="p-2 text-right font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentSales.map((o) => (
                    <tr key={o.uuid} className="hover:bg-gray-50">
                      <td className="p-2">
                        <Link to={`/sales/orders/${o.uuid}`} className="text-blue-600 hover:underline">
                          {o.document_number}
                        </Link>
                      </td>
                      <td className="p-2 text-gray-600 ltr-text">{o.document_date}</td>
                      <td className="p-2"><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card padded={false}>
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">آخر أوامر الشراء</h2>
            <Link to="/purchasing/orders" className="text-xs text-blue-600 hover:underline">
              عرض الكل
            </Link>
          </div>
          {purchaseOrdersQ.isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : purchaseOrdersQ.error ? (
            <div className="p-3"><ErrorState error={purchaseOrdersQ.error} /></div>
          ) : recentPurchases.length === 0 ? (
            <EmptyState message="لا توجد أوامر شراء بعد" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-2 text-right font-medium">رقم الأمر</th>
                    <th className="p-2 text-right font-medium">التاريخ</th>
                    <th className="p-2 text-right font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentPurchases.map((o) => (
                    <tr key={o.uuid} className="hover:bg-gray-50">
                      <td className="p-2">
                        <Link to={`/purchasing/orders/${o.uuid}`} className="text-blue-600 hover:underline">
                          {o.document_number}
                        </Link>
                      </td>
                      <td className="p-2 text-gray-600 ltr-text">{o.document_date}</td>
                      <td className="p-2"><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ---------- Footnote about data sources ---------- */}
      <p className="text-xs text-gray-400 mt-6 leading-relaxed">
        جميع المؤشرات محسوبة من الباك إند الفعلي عبر{' '}
        <code className="bg-gray-100 px-1 rounded">GET /api/v1/reporting/dashboard-summary</code>
        و endpoints القوائم. القيم المالية محسوبة من القيود المرحَّلة والأوامر المعتمدة.
        {summary && (
          <span className="block mt-1">آخر تحديث: <span className="ltr-text">{summary.as_of}</span></span>
        )}
      </p>
    </div>
  )
}

/** Local KPI tile (similar to KpiCard but with hover affordance for the Link wrapper). */
function KpiTile({
  label,
  value,
  subtitle,
  available = true,
  tone = 'default',
}: {
  label: string
  value?: string | number
  subtitle?: string
  available?: boolean
  tone?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const toneClasses: Record<string, string> = {
    default: 'text-gray-800',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-rose-700',
  }
  // Loading state — when value is undefined but available is true, we are
  // still waiting for the query. Show a skeleton instead of "—".
  const isLoading = available && value === undefined
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex flex-col gap-1 h-full">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      {isLoading ? (
        <Skeleton className="h-7 w-16 mt-1" />
      ) : available ? (
        <span className={`text-2xl font-bold ${toneClasses[tone]}`}>
          {value ?? '—'}
        </span>
      ) : (
        <span className="text-sm text-gray-400 mt-1">غير متاح حالياً</span>
      )}
      {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
    </div>
  )
}
