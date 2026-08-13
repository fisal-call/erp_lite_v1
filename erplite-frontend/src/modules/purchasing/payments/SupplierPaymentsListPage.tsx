/**
 * src/modules/purchasing/payments/SupplierPaymentsListPage.tsx
 *
 * Read-only list of supplier payments (purchasing.supplier_payment table).
 * Payments are amounts paid to suppliers against their invoices.
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

export function SupplierPaymentsListPage() {
  const [search, setSearch] = useUrlState('q', '')
  const [statusFilter, setStatusFilter] = useUrlState('status', 'all')
  const { data: payments, isLoading, error } = useQuery({
    queryKey: ['supplier-payments'],
    queryFn: () => reportingApi.listSupplierPayments({ limit: 200 }),
  })

  const filtered = useMemo(() => {
    if (!payments) return []
    const q = search.trim().toLowerCase()
    return payments.filter((p) => {
      const matchesSearch =
        !q ||
        p.document_number.toLowerCase().includes(q) ||
        p.supplier_name.toLowerCase().includes(q) ||
        p.invoice_number.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [payments, search, statusFilter])

  const totalAmount = filtered.reduce((s, p) => s + p.amount, 0)

  return (
    <div>
      <PageHeader title="سندات الصرف" />

      <FilterBar
        search={
          <input
            placeholder="بحث برقم السند أو المورد أو الفاتورة..."
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
            <tr><Th>رقم السند</Th><Th>المورد</Th><Th>الفاتورة</Th><Th>التاريخ</Th><Th>المبلغ</Th><Th>طريقة الدفع</Th><Th>الحالة</Th></tr>
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

      {payments && (
        <>
          <CountSummary
            shown={filtered.length}
            total={payments.length}
            breakdown={[{ label: 'إجمالي المدفوع', count: Math.round(totalAmount), tone: 'amber' }]}
          />
          {filtered.length === 0 ? (
            <Table>
              <thead><tr><Th>رقم السند</Th><Th>المورد</Th><Th>الفاتورة</Th><Th>التاريخ</Th><Th>المبلغ</Th><Th>طريقة الدفع</Th><Th>الحالة</Th></tr></thead>
              <tbody><tr><td colSpan={7}><EmptyState message="لا توجد سندات صرف بعد" /></td></tr></tbody>
            </Table>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>رقم السند</Th>
                  <Th>المورد</Th>
                  <Th>الفاتورة</Th>
                  <Th>التاريخ</Th>
                  <Th>المبلغ</Th>
                  <Th>طريقة الدفع</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((p) => (
                  <tr key={p.uuid} className="hover:bg-gray-50">
                    <Td className="font-mono text-xs">{p.document_number}</Td>
                    <Td>
                      <Link to={`/purchasing/suppliers/${p.supplier_uuid}`} className="text-blue-600 hover:underline">
                        {p.supplier_name}
                      </Link>
                    </Td>
                    <Td className="font-mono text-xs">{p.invoice_number}</Td>
                    <Td className="text-gray-700">{p.payment_date}</Td>
                    <Td className="text-amber-700 font-medium">{p.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                    <Td>{PAYMENT_METHOD_AR[p.payment_method] ?? p.payment_method}</Td>
                    <Td>
                      <StatusBadge status={p.status} />
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
