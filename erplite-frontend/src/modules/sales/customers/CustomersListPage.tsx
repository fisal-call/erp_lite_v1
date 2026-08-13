/**
 * src/modules/sales/customers/CustomersListPage.tsx
 *
 * Client-side search + status filter (backend has no ?search= / ?status=
 * params — recorded in BACKEND_REQUIRED.md). The "عرض" link points to the
 * detail route.
 *
 * Rows are clickable (cursor pointer) and navigate to the detail page.
 */
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { salesApi } from '../api'
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
import type { Customer } from '../types'

type StatusFilter = 'all' | 'active' | 'suspended'

export function CustomersListPage() {
  const navigate = useNavigate()
  const [searchStr, setSearchStr] = useUrlState('q', '')
  const [statusStr, setStatusStr] = useUrlState('status', 'all')
  // Keep typed aliases for the rest of the component.
  const search = searchStr
  const setSearch = setSearchStr
  const status = statusStr as StatusFilter
  const setStatus = (v: StatusFilter) => setStatusStr(v)
  const { data: customers, isLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: salesApi.listCustomers,
  })

  const filtered = useMemo(() => {
    if (!customers) return []
    const q = search.trim().toLowerCase()
    return customers.filter((c) => {
      const matchesSearch =
        !q ||
        c.customer_name.toLowerCase().includes(q) ||
        c.customer_code.toLowerCase().includes(q)
      const matchesStatus =
        status === 'all' ||
        (status === 'active' && c.is_active) ||
        (status === 'suspended' && !c.is_active)
      return matchesSearch && matchesStatus
    })
  }, [customers, search, status])

  const { sortKey, sortDir, toggleSort, sortData } = useSort<Customer>('customer_name', 'asc')
  const sorted = sortData(filtered, (c) => c[sortKey as keyof Customer] ?? '')

  const activeCount = customers?.filter((c) => c.is_active).length ?? 0
  const suspendedCount = (customers?.length ?? 0) - activeCount

  function handleRowClick(c: Customer) {
    navigate(`/sales/customers/${c.uuid}`)
  }

  const hasActiveFilters = !!search || status !== 'all'

  return (
    <div>
      <PageHeader
        title="العملاء"
        actions={
          <Link
            to="/sales/customers/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            + عميل جديد
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

      {customers && (
        <>
          <CountSummary
            shown={filtered.length}
            total={customers.length}
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
                    <EmptyState message={hasActiveFilters ? 'لا يوجد عملاء مطابقون للبحث' : 'لا يوجد عملاء بعد'} />
                  </td>
                </tr>
              </tbody>
            </Table>
          ) : (
            <Table>
              <thead>
                <tr>
                  <SortableTh label="الكود" sortKey="customer_code" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="الاسم" sortKey="customer_name" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th>الهاتف</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((c) => (
                  <tr
                    key={c.uuid}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleRowClick(c)}
                  >
                    <Td className="font-mono text-xs">{c.customer_code}</Td>
                    <Td className="font-medium text-gray-800">{c.customer_name}</Td>
                    <Td className="text-gray-600 ltr-text">{c.phone ?? '—'}</Td>
                    <Td><BooleanBadge value={c.is_active} /></Td>
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
