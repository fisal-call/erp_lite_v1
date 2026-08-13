/**
 * src/modules/accounting/JournalEntriesListPage.tsx
 *
 * List view of journal entries. Adds client-side status filter + count
 * summary + clickable rows.
 */
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { accountingApi } from './api'
import { StatusBadge } from '../../components/StatusBadge'
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
} from '../../components/ui'
import type { JournalEntrySummary } from './api'

type StatusFilter = 'all' | 'draft' | 'submitted'

export function JournalEntriesListPage() {
  const navigate = useNavigate()
  const [statusStr, setStatusStr] = useUrlState('status', 'all')
  const [search, setSearch] = useUrlState('q', '')
  const status = statusStr as StatusFilter
  const setStatus = (v: StatusFilter) => setStatusStr(v)
  const { data: entries, isLoading, error } = useQuery({
    queryKey: ['journal-entries', search || undefined],
    queryFn: () => accountingApi.listJournalEntries(search || undefined),
  })

  const filtered = useMemo(() => {
    if (!entries) return []
    return status === 'all'
      ? entries
      : entries.filter((e) => e.status === status)
  }, [entries, status])

  const { sortKey, sortDir, toggleSort, sortData } = useSort<JournalEntrySummary>('posting_date', 'desc')
  const sorted = sortData(filtered, (e) => e[sortKey as keyof JournalEntrySummary] ?? '')

  const draftCount = entries?.filter((e) => e.status === 'draft').length ?? 0
  const submittedCount = entries?.filter((e) => e.status === 'submitted').length ?? 0

  const hasActiveFilters = status !== 'all' || search.trim() !== ''

  return (
    <div>
      <PageHeader
        title="القيود اليومية"
        actions={
          <Link
            to="/accounting/journal-entries/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            + قيد جديد
          </Link>
        }
      />

      <FilterBar
        search={
          <input
            placeholder="بحث برقم القيد..."
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
            <option value="submitted">مرحَّل</option>
          </select>
        }
        onClear={() => {
          setStatus('all')
          setSearch('')
        }}
        hasActiveFilters={hasActiveFilters}
      />

      {isLoading && (
        <Table>
          <thead>
            <tr>
              <Th>رقم القيد</Th>
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

      {entries && (
        <>
          <CountSummary
            shown={filtered.length}
            total={entries.length}
            breakdown={[
              { label: 'مسودة', count: draftCount, tone: 'gray' },
              { label: 'مرحَّل', count: submittedCount, tone: 'green' },
            ]}
          />
          {sorted.length === 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>رقم القيد</Th>
                  <Th>التاريخ</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3}>
                    <EmptyState message={hasActiveFilters ? 'لا توجد قيود مطابقة' : 'لا توجد قيود بعد'} />
                  </td>
                </tr>
              </tbody>
            </Table>
          ) : (
            <Table>
              <thead>
                <tr>
                  <SortableTh label="رقم القيد" sortKey="document_number" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="التاريخ" sortKey="posting_date" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="الحالة" sortKey="status" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((e) => (
                  <tr
                    key={e.uuid}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/accounting/journal-entries/${e.uuid}`)}
                  >
                    <Td className="font-mono text-xs">{e.document_number}</Td>
                    <Td className="text-gray-600 ltr-text">{e.posting_date}</Td>
                    <Td><StatusBadge status={e.status} /></Td>
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
