/**
 * src/modules/inventory/StockBalancePage.tsx
 *
 * Read-only view of stock balance per (item, warehouse). Adds:
 *   - Search by item code or name
 *   - Filter by warehouse
 *   - Filter by stock level (all / positive / zero-or-negative)
 *   - Count summary
 *   - Print button
 *
 * Backend endpoint: GET /inventory/stock-balance (returns StockBalanceRead[]).
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi } from './api'
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
import type { StockBalance } from './api'

type StockFilter = 'all' | 'positive' | 'low'

export function StockBalancePage() {
  const [search, setSearch] = useUrlState('q', '')
  const [warehouse, setWarehouse] = useUrlState('warehouse', '')
  const [stockStr, setStockStr] = useUrlState('stock', 'all')
  const stock = stockStr as StockFilter
  const setStock = (v: StockFilter) => setStockStr(v)
  const { data, isLoading, error } = useQuery({
    queryKey: ['stock-balance'],
    queryFn: inventoryApi.stockBalance,
  })

  // Build a unique list of warehouses for the filter dropdown
  const warehouses = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.map((r) => r.warehouse_name))).sort()
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.filter((r) => {
      const matchesSearch =
        !q ||
        r.item_name.toLowerCase().includes(q) ||
        r.item_code.toLowerCase().includes(q)
      const matchesWarehouse = !warehouse || r.warehouse_name === warehouse
      const matchesStock =
        stock === 'all' ||
        (stock === 'positive' && r.qty_on_hand > 0) ||
        (stock === 'low' && r.qty_on_hand <= 0)
      return matchesSearch && matchesWarehouse && matchesStock
    })
  }, [data, search, warehouse, stock])

  const totalCount = data?.length ?? 0
  const lowCount = data?.filter((r) => r.qty_on_hand <= 0).length ?? 0

  const hasActiveFilters = !!search || !!warehouse || stock !== 'all'

  const { sortKey, sortDir, toggleSort, sortData } = useSort<StockBalance>('item_name', 'asc')
  const sorted = sortData(filtered, (r) => {
    if (sortKey === 'qty_on_hand') return r.qty_on_hand
    return r[sortKey as keyof StockBalance] ?? ''
  })

  return (
    <div>
      <PageHeader
        title="رصيد المخزون"
        actions={
          <button
            type="button"
            onClick={() => window.print()}
            className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            طباعة
          </button>
        }
      />

      <FilterBar
        search={
          <input
            placeholder="بحث بالصنف..."
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
        filters={
          <>
            <select
              className="input max-w-[160px]"
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
            >
              <option value="">كل المخازن</option>
              {warehouses.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <select
              className="input max-w-[140px]"
              value={stock}
              onChange={(e) => setStock(e.target.value as StockFilter)}
            >
              <option value="all">كل الأرصدة</option>
              <option value="positive">مرتفع (&gt;0)</option>
              <option value="low">منخفض (≤0)</option>
            </select>
          </>
        }
        onClear={() => {
          setSearch('')
          setWarehouse('')
          setStock('all')
        }}
        hasActiveFilters={hasActiveFilters}
      />

      {isLoading && (
        <Table>
          <thead>
            <tr>
              <Th>الصنف</Th>
              <Th>المخزن</Th>
              <Th>الكمية المتاحة</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td><Skeleton className="h-4 w-40" /></Td>
                <Td><Skeleton className="h-4 w-24" /></Td>
                <Td><Skeleton className="h-4 w-12" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {data && (
        <>
          <CountSummary
            shown={filtered.length}
            total={totalCount}
            breakdown={
              lowCount > 0
                ? [{ label: 'منخفض/نفد', count: lowCount, tone: 'rose' }]
                : undefined
            }
          />
          {sorted.length === 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>الصنف</Th>
                  <Th>المخزن</Th>
                  <Th>الكمية المتاحة</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3}>
                    <EmptyState message={hasActiveFilters ? 'لا توجد أرصدة مطابقة' : 'لا توجد حركات مخزون بعد'} />
                  </td>
                </tr>
              </tbody>
            </Table>
          ) : (
            <Table>
              <thead>
                <tr>
                  <SortableTh label="الصنف" sortKey="item_name" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="المخزن" sortKey="warehouse_name" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="الكمية المتاحة" sortKey="qty_on_hand" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <Td>
                      <div className="font-medium text-gray-800">{row.item_name}</div>
                      <div className="font-mono text-xs text-gray-500">{row.item_code}</div>
                    </Td>
                    <Td className="text-gray-600">{row.warehouse_name}</Td>
                    <Td
                      className={`font-medium ${
                        row.qty_on_hand <= 0 ? 'text-rose-600' : 'text-gray-800'
                      }`}
                    >
                      {row.qty_on_hand}
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
