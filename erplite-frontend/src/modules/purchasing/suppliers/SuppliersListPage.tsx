/**
 * src/modules/purchasing/suppliers/SuppliersListPage.tsx
 *
 * Client-side search + status filter. Rows clickable to detail page.
 */
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { purchasingApi } from '../api'
import {
  BooleanBadge,
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
import type { Supplier } from '../types'

type StatusFilter = 'all' | 'active' | 'suspended'

export function SuppliersListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useUrlState('q', '')
  const [statusStr, setStatusStr] = useUrlState('status', 'all')
  const status = statusStr as StatusFilter
  const setStatus = (v: StatusFilter) => setStatusStr(v)
  const { data: suppliers, isLoading, error } = useQuery({
    queryKey: ['suppliers'],
    queryFn: purchasingApi.listSuppliers,
  })

  const filtered = useMemo(() => {
    if (!suppliers) return []
    const q = search.trim().toLowerCase()
    return suppliers.filter((s) => {
      const matchesSearch =
        !q ||
        s.supplier_name.toLowerCase().includes(q) ||
        s.supplier_code.toLowerCase().includes(q)
      const matchesStatus =
        status === 'all' ||
        (status === 'active' && s.is_active) ||
        (status === 'suspended' && !s.is_active)
      return matchesSearch && matchesStatus
    })
  }, [suppliers, search, status])

  const { sortKey, sortDir, toggleSort, sortData } = useSort<Supplier>('supplier_name', 'asc')
  const sorted = sortData(filtered, (s) => s[sortKey as keyof Supplier] ?? '')

  const activeCount = suppliers?.filter((s) => s.is_active).length ?? 0
  const suspendedCount = (suppliers?.length ?? 0) - activeCount

  function handleRowClick(s: Supplier) {
    navigate(`/purchasing/suppliers/${s.uuid}`)
  }

  const hasActiveFilters = !!search || status !== 'all'

  return (
    <div>
      <PageHeader
        title="الموردون"
        actions={
          <Link
            to="/purchasing/suppliers/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            + مورد جديد
          </Link>
        }
      />

      <FilterBar
        search={
          <input
            placeholder="بحث بالاسم أو الكود..."
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
        filters={
          <select
            className="input max-w-[140px]"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="all">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="suspended">موقوف</option>
          </select>
        }
        onClear={() => {
          setSearch('')
          setStatus('all')
        }}
        hasActiveFilters={hasActiveFilters}
      />

      {isLoading && (
        <Table>
          <thead>
            <tr>
              <Th>الكود</Th>
              <Th>الاسم</Th>
              <Th>الهاتف</Th>
              <Th>الحالة</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td><Skeleton className="h-4 w-16" /></Td>
                <Td><Skeleton className="h-4 w-40" /></Td>
                <Td><Skeleton className="h-4 w-28" /></Td>
                <Td><Skeleton className="h-5 w-14 rounded-full" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {suppliers && (
        <>
          <CountSummary
            shown={filtered.length}
            total={suppliers.length}
            breakdown={[
              { label: 'نشط', count: activeCount, tone: 'green' },
              { label: 'موقوف', count: suspendedCount, tone: 'rose' },
            ]}
          />
          {sorted.length === 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>الكود</Th>
                  <Th>الاسم</Th>
                  <Th>الهاتف</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4}>
                    <EmptyState message={hasActiveFilters ? 'لا يوجد موردون مطابقون للبحث' : 'لا يوجد موردون بعد'} />
                  </td>
                </tr>
              </tbody>
            </Table>
          ) : (
            <Table>
              <thead>
                <tr>
                  <SortableTh label="الكود" sortKey="supplier_code" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="الاسم" sortKey="supplier_name" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th>الهاتف</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((s) => (
                  <tr
                    key={s.uuid}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleRowClick(s)}
                  >
                    <Td className="font-mono text-xs">{s.supplier_code}</Td>
                    <Td className="font-medium text-gray-800">{s.supplier_name}</Td>
                    <Td className="text-gray-600 ltr-text">{s.phone ?? '—'}</Td>
                    <Td><BooleanBadge value={s.is_active} /></Td>
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
