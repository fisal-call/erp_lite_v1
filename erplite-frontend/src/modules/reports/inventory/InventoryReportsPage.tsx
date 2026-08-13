/**
 * src/modules/reports/inventory/InventoryReportsPage.tsx
 *
 * Inventory analytics — Low-stock report and stock balance.
 * Uses /reporting/low-stock and existing /inventory/stock-balance endpoint.
 */
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { reportingApi } from '../../reporting/api'
import {
  Card,
  EmptyState,
  ErrorState,
  KpiCard,
  PageHeader,
  Skeleton,
  Table,
  Th,
  Td,
  useUrlState,
} from '../../../components/ui'

export function InventoryReportsPage() {
  const [thresholdStr, setThresholdStr] = useUrlState('threshold', '0')
  const threshold = Number(thresholdStr) || 0
  const lowStockQ = useQuery({
    queryKey: ['low-stock', threshold],
    queryFn: () => reportingApi.listLowStock(threshold),
  })

  const lowStock = lowStockQ.data ?? []
  const uniqueLowItems = new Set(lowStock.map((r) => r.item_uuid)).size

  return (
    <div>
      <PageHeader title="تقارير المخزون" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <KpiCard label="أصناف منخفضة المخزون" value={String(uniqueLowItems)} tone="danger" />
        <KpiCard label="صفوف منخفضة المخزون" value={String(lowStock.length)} tone="warning" />
        <Link to="/inventory/stock-balance" className="block">
          <KpiCard label="رصيد المخزون" value="عرض التفاصيل" tone="default" />
        </Link>
      </div>

      {lowStockQ.error && <div className="mb-4"><ErrorState error={lowStockQ.error} /></div>}

      <Card className="mb-6">
        <div className="px-4 pt-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-800">
            الأصناف منخفضة المخزون (رصيد ≤ {threshold})
          </h2>
          <div>
            <label className="block text-xs text-gray-600 mb-1">حد المخزون المنخفض</label>
            <input
              type="number"
              className="input max-w-[140px]"
              value={thresholdStr}
              onChange={(e) => setThresholdStr(e.target.value)}
              min="0"
              step="1"
            />
          </div>
        </div>
        <div className="p-2">
          {lowStockQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : lowStock.length === 0 ? (
            <EmptyState message="لا توجد أصناف منخفضة المخزون — كل الأصناف لها رصيد موجب" />
          ) : (
            <Table>
              <thead>
                <tr><Th>الكود</Th><Th>الصنف</Th><Th>المخزن</Th><Th>الرصيد</Th></tr>
              </thead>
              <tbody className="divide-y">
                {lowStock.map((r) => (
                  <tr key={`${r.item_uuid}-${r.warehouse_uuid ?? 'none'}`} className="hover:bg-gray-50">
                    <Td className="font-mono text-xs">{r.item_code}</Td>
                    <Td>
                      <Link to={`/inventory/items/${r.item_uuid}`} className="text-blue-600 hover:underline">
                        {r.item_name}
                      </Link>
                    </Td>
                    <Td className="text-gray-700">{r.warehouse_name ?? '—'}</Td>
                    <Td className="font-bold text-rose-700">{r.qty_on_hand.toLocaleString('en-US', { maximumFractionDigits: 4 })}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-gray-800 px-4 pt-4">حركات المخزون</h2>
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-3">
            لعرض كل حركات المخزون (الإضافة والصرف والتحويل)، انتقل إلى صفحة حركات المخزون.
          </p>
          <Link
            to="/inventory/stock-movements"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            عرض حركات المخزون ←
          </Link>
        </div>
      </Card>
    </div>
  )
}
