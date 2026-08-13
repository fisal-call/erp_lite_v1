/**
 * src/modules/sales/invoices/SalesInvoicesListPage.tsx
 *
 * Read-only list of sales invoices (sales.sales_invoice table — was missing
 * an endpoint until /reporting/sales-invoices was added).
 *
 * NOTE: Sales invoices currently exist only via direct DB entry. The backend
 * has no sales-order-to-invoice auto-creation flow yet; this list shows
 * whatever invoices have been seeded/inserted directly.
 */
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { reportingApi as repApi } from '../../reporting/api'
import { StatusBadge } from '../../../components/StatusBadge'
import {
  CountSummary,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Skeleton,
  Table,
  Th,
  Td,
  useUrlState,
} from '../../../components/ui'

export function SalesInvoicesListPage() {
  const [search, setSearch] = useUrlState('q', '')
  const [statusFilter, setStatusFilter] = useUrlState('status', 'all')

  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ['sales-invoices'],
    queryFn: () => repApi.listSalesInvoices({ limit: 200 }),
  })

  const filtered = useMemo(() => {
    if (!invoices) return []
    const q = search.trim().toLowerCase()
    return invoices.filter((i) => {
      const matchesSearch =
        !q ||
        i.document_number.toLowerCase().includes(q) ||
        i.customer_name.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || i.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [invoices, search, statusFilter])

  const totalAmount = filtered.reduce((s, i) => s + i.total_amount, 0)
  const totalDue = filtered.reduce((s, i) => s + i.balance_due, 0)

  return (
    <div>
      <PageHeader title="فواتير المبيعات" />

      <FilterBar
        search={
          <input
            placeholder="بحث برقم الفاتورة أو العميل..."
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
        filters={
          <select
            className="input max-w-[160px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="submitted">مُقدَّمة</option>
            <option value="approved">معتمدة</option>
            <option value="closed">مغلقة</option>
            <option value="cancelled">ملغاة</option>
          </select>
        }
        onClear={() => { setSearch(''); setStatusFilter('all') }}
        hasActiveFilters={!!search || statusFilter !== 'all'}
      />

      {isLoading && (
        <Table>
          <thead>
            <tr><Th>رقم الفاتورة</Th><Th>العميل</Th><Th>التاريخ</Th><Th>المبلغ</Th><Th>المحصل</Th><Th>المستحق</Th><Th>الحالة</Th></tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td><Skeleton className="h-4 w-24" /></Td>
                <Td><Skeleton className="h-4 w-40" /></Td>
                <Td><Skeleton className="h-4 w-24" /></Td>
                <Td><Skeleton className="h-4 w-20" /></Td>
                <Td><Skeleton className="h-4 w-20" /></Td>
                <Td><Skeleton className="h-4 w-20" /></Td>
                <Td><Skeleton className="h-4 w-16" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {invoices && (
        <>
          <CountSummary
            shown={filtered.length}
            total={invoices.length}
            breakdown={[
              { label: 'إجمالي القيمة', count: Math.round(totalAmount), tone: 'rose' },
              { label: 'إجمالي المستحق', count: Math.round(totalDue), tone: 'rose' },
            ]}
          />
          {filtered.length === 0 ? (
            <Table>
              <thead><tr><Th>رقم الفاتورة</Th><Th>العميل</Th><Th>التاريخ</Th><Th>المبلغ</Th><Th>المحصل</Th><Th>المستحق</Th><Th>الحالة</Th></tr></thead>
              <tbody><tr><td colSpan={7}><EmptyState message="لا توجد فواتير مبيعات بعد — حالياً يتم إنشاء الفواتير عبر قاعدة البيانات مباشرة" /></td></tr></tbody>
            </Table>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>رقم الفاتورة</Th>
                  <Th>العميل</Th>
                  <Th>التاريخ</Th>
                  <Th>المبلغ</Th>
                  <Th>المحصل</Th>
                  <Th>المستحق</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((inv) => (
                  <tr key={inv.uuid} className="hover:bg-gray-50">
                    <Td className="font-mono text-xs">{inv.document_number}</Td>
                    <Td>
                      <Link to={`/sales/customers/${inv.customer_uuid}`} className="text-blue-600 hover:underline">
                        {inv.customer_name}
                      </Link>
                    </Td>
                    <Td className="text-gray-700">{inv.document_date}</Td>
                    <Td className="text-gray-800">{inv.total_amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                    <Td className="text-green-700">{inv.paid_amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                    <Td className={`font-bold ${inv.balance_due > 0 ? 'text-rose-700' : 'text-gray-500'}`}>
                      {inv.balance_due.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </Td>
                    <Td>
                      <StatusBadge status={inv.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
    </div>
  )
}
