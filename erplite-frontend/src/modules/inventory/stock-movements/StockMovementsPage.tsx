/**
 * src/modules/inventory/stock-movements/StockMovementsPage.tsx
 *
 * Read-only list of stock ledger entries (inventory.stock_ledger_entry).
 * Shows every stock movement (in/out/transfer) with item, warehouse, qty_change,
 * and source document type.
 */
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { reportingApi } from '../../reporting/api'
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

const SOURCE_DOCTYPE_AR: Record<string, string> = {
  sales_order: 'أمر بيع',
  sales_delivery: 'تسليم بيع',
  purchase_receipt: 'استلام شراء',
  stock_adjustment: 'تسوية مخزون',
  stock_transfer: 'تحويل مخزون',
  sales_return: 'مرتجع بيع',
  purchase_return: 'مرتجع شراء',
}

export function StockMovementsPage() {
  const [search, setSearch] = useUrlState('q', '')
  const [doctypeFilter, setDoctypeFilter] = useUrlState('source', 'all')
  const [dateFrom, setDateFrom] = useUrlState('from', '')
  const [dateTo, setDateTo] = useUrlState('to', '')
  const { data: movements, isLoading, error } = useQuery({
    queryKey: ['stock-movements', dateFrom || undefined, dateTo || undefined],
    queryFn: () =>
      reportingApi.listStockMovements({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: 500,
      }),
  })

  const filtered = useMemo(() => {
    if (!movements) return []
    const q = search.trim().toLowerCase()
    return movements.filter((m) => {
      const matchesSearch =
        !q ||
        (m.item_code ?? '').toLowerCase().includes(q) ||
        (m.item_name ?? '').toLowerCase().includes(q) ||
        (m.warehouse_name ?? '').toLowerCase().includes(q)
      const matchesDoctype = doctypeFilter === 'all' || m.source_doctype === doctypeFilter
      return matchesSearch && matchesDoctype
    })
  }, [movements, search, doctypeFilter])

  const totalIn = filtered.filter((m) => m.qty_change > 0).reduce((s, m) => s + m.qty_change, 0)
  const totalOut = filtered.filter((m) => m.qty_change < 0).reduce((s, m) => s + m.qty_change, 0)

  return (
    <div>
      <PageHeader title="حركات المخزون" />

      <FilterBar
        search={
          <input
            placeholder="بحث بالصنف أو المخزن..."
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
        filters={
          <>
            <input
              type="date"
              className="input max-w-[150px]"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="من تاريخ"
              aria-label="من تاريخ"
            />
            <input
              type="date"
              className="input max-w-[150px]"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="إلى تاريخ"
              aria-label="إلى تاريخ"
            />
            <select
              className="input max-w-[180px]"
              value={doctypeFilter}
              onChange={(e) => setDoctypeFilter(e.target.value)}
            >
              <option value="all">كل المصادر</option>
              {Object.entries(SOURCE_DOCTYPE_AR).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </>
        }
        onClear={() => {
          setSearch('')
          setDoctypeFilter('all')
          setDateFrom('')
          setDateTo('')
        }}
        hasActiveFilters={!!search || doctypeFilter !== 'all' || !!dateFrom || !!dateTo}
      />

      {isLoading && (
        <Table>
          <thead>
            <tr><Th>التاريخ</Th><Th>الصنف</Th><Th>المخزن</Th><Th>الكمية</Th><Th>المصدر</Th></tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td><Skeleton className="h-4 w-24" /></Td>
                <Td><Skeleton className="h-4 w-40" /></Td>
                <Td><Skeleton className="h-4 w-32" /></Td>
                <Td><Skeleton className="h-4 w-16" /></Td>
                <Td><Skeleton className="h-4 w-24" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {movements && (
        <>
          <CountSummary
            shown={filtered.length}
            total={movements.length}
            breakdown={[
              { label: 'إجمالي الوارد', count: Math.round(totalIn), tone: 'green' },
              { label: 'إجمالي الصادر', count: Math.round(totalOut), tone: 'rose' },
            ]}
          />
          {filtered.length === 0 ? (
            <Table>
              <thead><tr><Th>التاريخ</Th><Th>الصنف</Th><Th>المخزن</Th><Th>الكمية</Th><Th>المصدر</Th></tr></thead>
              <tbody><tr><td colSpan={5}><EmptyState message="لا توجد حركات مخزون بعد — تُنشأ تلقائياً من أوامر البيع/الشراء" /></td></tr></tbody>
            </Table>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>التاريخ</Th>
                  <Th>الصنف</Th>
                  <Th>المخزن</Th>
                  <Th>الكمية</Th>
                  <Th>سعر التقييم</Th>
                  <Th>المصدر</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((m) => (
                  <tr key={m.uuid} className="hover:bg-gray-50">
                    <Td className="text-gray-700">{m.posting_date}</Td>
                    <Td>
                      {m.item_uuid ? (
                        <Link to={`/inventory/items/${m.item_uuid}`} className="text-blue-600 hover:underline">
                          <div className="font-mono text-xs">{m.item_code}</div>
                          <div className="text-xs text-gray-600">{m.item_name}</div>
                        </Link>
                      ) : '—'}
                    </Td>
                    <Td className="text-gray-700">{m.warehouse_name ?? '—'}</Td>
                    <Td className={`font-bold ${m.qty_change > 0 ? 'text-green-700' : 'text-rose-700'}`}>
                      {m.qty_change > 0 ? '+' : ''}{m.qty_change.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                    </Td>
                    <Td className="text-gray-600">
                      {m.valuation_rate !== null ? m.valuation_rate.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
                    </Td>
                    <Td>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                        {SOURCE_DOCTYPE_AR[m.source_doctype] ?? m.source_doctype}
                      </span>
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
