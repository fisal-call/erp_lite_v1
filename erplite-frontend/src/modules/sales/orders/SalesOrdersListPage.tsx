/**
 * src/modules/sales/orders/SalesOrdersListPage.tsx
 *
 * List view of sales orders. The summary DTO (SalesOrderSummaryRead)
 * exposes only document_number/document_date/status — total_amount is
 * not included (documented gap in BACKEND_REQUIRED.md).
 *
 * Adds:
 *   - Client-side status filter (draft/submitted/closed)
 *   - Count summary with breakdown
 *   - Clickable rows navigating to detail page
 */
import { useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { salesApi } from '../api'
import { StatusBadge } from '../../../components/StatusBadge'
import {
  CountSummary,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Skeleton,
  SortableTh,
  Table,
  Th,
  Td,
  useSort,
  useUrlState,
} from '../../../components/ui'
import type { SalesOrderSummary } from '../types'

type StatusFilter = 'all' | 'draft' | 'submitted' | 'closed'

export function SalesOrdersListPage() {
  const navigate = useNavigate()
  const [statusStr, setStatusStr] = useUrlState('status', 'all')
  const [search, setSearch] = useUrlState('q', '')
  const status = statusStr as StatusFilter
  const setStatus = (v: StatusFilter) => setStatusStr(v)
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['sales-orders', search || undefined],
    queryFn: () => salesApi.listSalesOrders(search || undefined),
  })

  const filtered = useMemo(() => {
    if (!orders) return []
    return status === 'all'
      ? orders
      : orders.filter((o) => o.status === status)
  }, [orders, status])

  const { sortKey, sortDir, toggleSort, sortData } = useSort<SalesOrderSummary>('document_date', 'desc')
  const sorted = sortData(filtered, (o) => o[sortKey as keyof SalesOrderSummary] ?? '')

  const draftCount = orders?.filter((o) => o.status === 'draft').length ?? 0
  const submittedCount = orders?.filter((o) => o.status === 'submitted').length ?? 0
  const closedCount = orders?.filter((o) => o.status === 'closed').length ?? 0

  const hasActiveFilters = status !== 'all' || search.trim() !== ''

  return (
    <div>
      <PageHeader
        title="أوامر البيع"
        actions={
          <Link
            to="/sales/orders/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            + أمر بيع جديد
          </Link>
        }
      />

      <FilterBar
        search={
          <input
            placeholder="بحث برقم الأمر..."
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
        filters={
          <select
            className="input max-w-[160px]"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="all">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="submitted">معتمد</option>
            <option value="closed">مغلق</option>
          </select>
        }
        onClear={() => { setStatus('all'); setSearch('') }}
        hasActiveFilters={hasActiveFilters}
      />

      {isLoading && (
        <Table>
          <thead>
            <tr>
              <Th>رقم الأمر</Th>
              <Th>التاريخ</Th>
              <Th>الحالة</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td><Skeleton className="h-4 w-28" /></Td>
                <Td><Skeleton className="h-4 w-24" /></Td>
                <Td><Skeleton className="h-5 w-16 rounded-full" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {orders && (
        <>
          <CountSummary
            shown={filtered.length}
            total={orders.length}
            breakdown={[
              { label: 'مسودة', count: draftCount, tone: 'gray' },
              { label: 'معتمد', count: submittedCount, tone: 'green' },
              { label: 'مغلق', count: closedCount, tone: 'amber' },
            ]}
          />
          {sorted.length === 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>رقم الأمر</Th>
                  <Th>التاريخ</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3}>
                    <EmptyState message={hasActiveFilters ? 'لا توجد أوامر مطابقة' : 'لا توجد أوامر بيع بعد'} />
                  </td>
                </tr>
              </tbody>
            </Table>
          ) : (
            <Table>
              <thead>
                <tr>
                  <SortableTh label="رقم الأمر" sortKey="document_number" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="التاريخ" sortKey="document_date" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="الحالة" sortKey="status" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((o) => (
                  <tr
                    key={o.uuid}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/sales/orders/${o.uuid}`)}
                  >
                    <Td className="font-mono text-xs">{o.document_number}</Td>
                    <Td className="text-gray-600 ltr-text">{o.document_date}</Td>
                    <Td><StatusBadge status={o.status} /></Td>
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
