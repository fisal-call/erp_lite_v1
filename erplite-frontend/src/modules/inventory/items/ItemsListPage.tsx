/**
 * src/modules/inventory/items/ItemsListPage.tsx
 *
 * Client-side search + status filter. Rows clickable to detail page.
 * Uses the existing /inventory/items endpoint (paginated server-side, we
 * pull up to 200 rows and filter client-side).
 */
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi } from '../api'
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
import type { Item } from '../api'

type StatusFilter = 'all' | 'active' | 'suspended'

export function ItemsListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useUrlState('q', '')
  const [statusStr, setStatusStr] = useUrlState('status', 'all')
  const status = statusStr as StatusFilter
  const setStatus = (v: StatusFilter) => setStatusStr(v)
  const { data: items, isLoading, error } = useQuery({
    queryKey: ['items'],
    queryFn: inventoryApi.listItems,
  })

  const filtered = useMemo(() => {
    if (!items) return []
    const q = search.trim().toLowerCase()
    return items.filter((i) => {
      const matchesSearch =
        !q ||
        i.item_name.toLowerCase().includes(q) ||
        i.item_code.toLowerCase().includes(q)
      const matchesStatus =
        status === 'all' ||
        (status === 'active' && i.is_active) ||
        (status === 'suspended' && !i.is_active)
      return matchesSearch && matchesStatus
    })
  }, [items, search, status])

  const { sortKey, sortDir, toggleSort, sortData } = useSort<Item>('item_name', 'asc')
  const sorted = sortData(filtered, (i) => i[sortKey as keyof Item] ?? '')

  const activeCount = items?.filter((i) => i.is_active).length ?? 0
  const suspendedCount = (items?.length ?? 0) - activeCount

  function handleRowClick(i: Item) {
    navigate(`/inventory/items/${i.uuid}`)
  }

  const hasActiveFilters = !!search || status !== 'all'

  return (
    <div>
      <PageHeader
        title="الأصناف"
        actions={
          <Link
            to="/inventory/items/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            + صنف جديد
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
              <Th>الحالة</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td><Skeleton className="h-4 w-16" /></Td>
                <Td><Skeleton className="h-4 w-40" /></Td>
                <Td><Skeleton className="h-5 w-14 rounded-full" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {items && (
        <>
          <CountSummary
            shown={filtered.length}
            total={items.length}
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
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3}>
                    <EmptyState message={hasActiveFilters ? 'لا توجد أصناف مطابقة' : 'لا توجد أصناف بعد'} />
                  </td>
                </tr>
              </tbody>
            </Table>
          ) : (
            <Table>
              <thead>
                <tr>
                  <SortableTh label="الكود" sortKey="item_code" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="الاسم" sortKey="item_name" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((i) => (
                  <tr
                    key={i.uuid}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleRowClick(i)}
                  >
                    <Td className="font-mono text-xs">{i.item_code}</Td>
                    <Td className="font-medium text-gray-800">{i.item_name}</Td>
                    <Td><BooleanBadge value={i.is_active} /></Td>
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
