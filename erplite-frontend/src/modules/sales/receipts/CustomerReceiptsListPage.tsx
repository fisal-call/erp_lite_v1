/**
 * src/modules/sales/receipts/CustomerReceiptsListPage.tsx
 *
 * Read-only list of customer receipts (sales.customer_receipt table).
 * Receipts are payments received from customers against their invoices.
 */
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { reportingApi } from '../../reporting/api'
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

const PAYMENT_METHOD_AR: Record<string, string> = {
  cash: 'نقدي',
  bank: 'تحويل بنكي',
  cheque: 'شيك',
}

export function CustomerReceiptsListPage() {
  const [search, setSearch] = useUrlState('q', '')
  const [statusFilter, setStatusFilter] = useUrlState('status', 'all')
  const { data: receipts, isLoading, error } = useQuery({
    queryKey: ['customer-receipts'],
    queryFn: () => reportingApi.listCustomerReceipts({ limit: 200 }),
  })

  const filtered = useMemo(() => {
    if (!receipts) return []
    const q = search.trim().toLowerCase()
    return receipts.filter((r) => {
      const matchesSearch =
        !q ||
        r.document_number.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        r.invoice_number.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [receipts, search, statusFilter])

  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0)

  return (
    <div>
      <PageHeader title="سندات القبض" />

      <FilterBar
        search={
          <input
            placeholder="بحث برقم السند أو العميل أو الفاتورة..."
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
            <option value="cancelled">ملغاة</option>
          </select>
        }
        onClear={() => { setSearch(''); setStatusFilter('all') }}
        hasActiveFilters={!!search || statusFilter !== 'all'}
      />

      {isLoading && (
        <Table>
          <thead>
            <tr><Th>رقم السند</Th><Th>العميل</Th><Th>الفاتورة</Th><Th>التاريخ</Th><Th>المبلغ</Th><Th>طريقة السداد</Th><Th>الحالة</Th></tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td><Skeleton className="h-4 w-24" /></Td>
                <Td><Skeleton className="h-4 w-40" /></Td>
                <Td><Skeleton className="h-4 w-24" /></Td>
                <Td><Skeleton className="h-4 w-24" /></Td>
                <Td><Skeleton className="h-4 w-20" /></Td>
                <Td><Skeleton className="h-4 w-20" /></Td>
                <Td><Skeleton className="h-4 w-16" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {receipts && (
        <>
          <CountSummary
            shown={filtered.length}
            total={receipts.length}
            breakdown={[{ label: 'إجمالي المحصَّل', count: Math.round(totalAmount), tone: 'green' }]}
          />
          {filtered.length === 0 ? (
            <Table>
              <thead><tr><Th>رقم السند</Th><Th>العميل</Th><Th>الفاتورة</Th><Th>التاريخ</Th><Th>المبلغ</Th><Th>طريقة السداد</Th><Th>الحالة</Th></tr></thead>
              <tbody><tr><td colSpan={7}><EmptyState message="لا توجد سندات قبض بعد" /></td></tr></tbody>
            </Table>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>رقم السند</Th>
                  <Th>العميل</Th>
                  <Th>الفاتورة</Th>
                  <Th>التاريخ</Th>
                  <Th>المبلغ</Th>
                  <Th>طريقة السداد</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => (
                  <tr key={r.uuid} className="hover:bg-gray-50">
                    <Td className="font-mono text-xs">{r.document_number}</Td>
                    <Td>
                      <Link to={`/sales/customers/${r.customer_uuid}`} className="text-blue-600 hover:underline">
                        {r.customer_name}
                      </Link>
                    </Td>
                    <Td className="font-mono text-xs">{r.invoice_number}</Td>
                    <Td className="text-gray-700">{r.receipt_date}</Td>
                    <Td className="text-green-700 font-medium">{r.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                    <Td>{PAYMENT_METHOD_AR[r.payment_method] ?? r.payment_method}</Td>
                    <Td>
                      <StatusBadge status={r.status} />
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
