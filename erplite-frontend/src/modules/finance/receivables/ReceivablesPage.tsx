/**
 * src/modules/finance/receivables/ReceivablesPage.tsx
 *
 * Customer receivables — uses /reporting/customer-outstanding (sourced from
 * reporting.v_customer_outstanding DB view). Shows per-customer balance_due
 * and totals at the top.
 *
 * Filtering is done client-side via useMemo on the full result set, with the
 * search query persisted in the URL via useUrlState so refresh/back/forward
 * restore the user's view.
 */
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { reportingApi } from '../../reporting/api'
import {
  CountSummary,
  EmptyState,
  ErrorState,
  FilterBar,
  KpiCard,
  PageHeader,
  Skeleton,
  Table,
  Th,
  Td,
  useUrlState,
} from '../../../components/ui'

export function ReceivablesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useUrlState('q', '')
  const { data: rows, isLoading, error } = useQuery({
    queryKey: ['customer-outstanding'],
    queryFn: reportingApi.listCustomerOutstanding,
  })

  const filteredRows = useMemo(() => {
    if (!rows) return []
    const v = search.trim().toLowerCase()
    if (!v) return rows
    return rows.filter(
      (r) =>
        r.customer_code.toLowerCase().includes(v) ||
        r.customer_name.toLowerCase().includes(v),
    )
  }, [rows, search])

  // KPIs are computed from the FULL result set (`rows`), not `filteredRows`,
  // so the totals stay correct even when the user is searching for a specific
  // customer. Labels say "إجمالي" (grand total) — values must match.
  const totalInvoiced = (rows ?? []).reduce((s, r) => s + r.total_invoiced, 0)
  const totalPaid = (rows ?? []).reduce((s, r) => s + r.total_paid, 0)
  const totalDue = (rows ?? []).reduce((s, r) => s + r.balance_due, 0)
  const customersWithDue = (rows ?? []).filter((r) => r.balance_due > 0).length

  return (
    <div>
      <PageHeader title="الذمم المدينة (المستحقات على العملاء)" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="إجمالي الفواتير" value={totalInvoiced.toLocaleString('en-US', { maximumFractionDigits: 2 })} tone="default" />
        <KpiCard label="إجمالي المحصل" value={totalPaid.toLocaleString('en-US', { maximumFractionDigits: 2 })} tone="success" />
        <KpiCard label="إجمالي الرصيد المستحق" value={totalDue.toLocaleString('en-US', { maximumFractionDigits: 2 })} tone="warning" />
        <KpiCard label="عملاء برصيد مستحق" value={String(customersWithDue)} tone="danger" />
      </div>

      <FilterBar
        search={
          <input
            placeholder="بحث برقم العميل أو الاسم..."
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
        onClear={() => setSearch('')}
        hasActiveFilters={search.trim() !== ''}
      />

      {isLoading && (
        <Table>
          <thead>
            <tr><Th>الكود</Th><Th>العميل</Th><Th>الفواتير</Th><Th>المحصل</Th><Th>المستحق</Th></tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td><Skeleton className="h-4 w-16" /></Td>
                <Td><Skeleton className="h-4 w-40" /></Td>
                <Td><Skeleton className="h-4 w-20" /></Td>
                <Td><Skeleton className="h-4 w-20" /></Td>
                <Td><Skeleton className="h-4 w-20" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {rows && (
        <>
          <CountSummary
            shown={filteredRows.length}
            total={rows.length}
            breakdown={[
              { label: 'برصيد مستحق', count: customersWithDue, tone: 'rose' },
              { label: 'خالص', count: filteredRows.length - customersWithDue, tone: 'green' },
            ]}
          />
          {filteredRows.length === 0 ? (
            <Table>
              <thead><tr><Th>الكود</Th><Th>العميل</Th><Th>الفواتير</Th><Th>المحصل</Th><Th>المستحق</Th></tr></thead>
              <tbody><tr><td colSpan={5}><EmptyState message={rows.length === 0 ? 'لا يوجد عملاء بعد' : 'لا توجد نتائج مطابقة لبحثك'} /></td></tr></tbody>
            </Table>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>الكود</Th>
                  <Th>العميل</Th>
                  <Th>إجمالي الفواتير</Th>
                  <Th>إجمالي المحصل</Th>
                  <Th>الرصيد المستحق</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.map((r) => (
                  <tr
                    key={r.customer_uuid}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/sales/customers/${r.customer_uuid}`)}
                  >
                    <Td className="font-mono text-xs">{r.customer_code}</Td>
                    <Td className="font-medium text-gray-800">{r.customer_name}</Td>
                    <Td className="text-gray-700">{r.total_invoiced.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                    <Td className="text-green-700">{r.total_paid.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                    <Td className={`font-bold ${r.balance_due > 0 ? 'text-rose-700' : 'text-gray-500'}`}>
                      {r.balance_due.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <div className="mt-4 text-sm text-gray-500">
            <Link to="/reports/sales" className="text-blue-600 hover:underline">← عرض تقارير المبيعات التفصيلية</Link>
          </div>
        </>
      )}
    </div>
  )
}
