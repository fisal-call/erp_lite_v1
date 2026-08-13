/**
 * src/modules/reports/purchasing/PurchasingReportsPage.tsx
 *
 * Purchase analytics — uses /reporting/purchase-summary and
 * /reporting/purchase-by-supplier.
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

export function PurchasingReportsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useUrlState('from', firstOfMonth)
  const [dateTo, setDateTo] = useUrlState('to', today)

  const summaryQ = useQuery({
    queryKey: ['purchase-summary', dateFrom, dateTo],
    queryFn: () => reportingApi.getPurchaseSummary('month', dateFrom, dateTo),
  })
  const bySupplierQ = useQuery({
    queryKey: ['purchase-by-supplier', dateFrom, dateTo],
    queryFn: () => reportingApi.getPurchaseBySupplier(dateFrom, dateTo),
  })
  const byItemQ = useQuery({
    queryKey: ['purchase-by-item', dateFrom, dateTo],
    queryFn: () => reportingApi.getPurchaseByItem(dateFrom, dateTo),
  })

  const totalPurchases = summaryQ.data?.reduce((s, r) => s + r.total_amount, 0) ?? 0
  const totalOrders = summaryQ.data?.reduce((s, r) => s + r.total_orders, 0) ?? 0
  const totalQty = summaryQ.data?.reduce((s, r) => s + r.total_qty, 0) ?? 0

  const error = summaryQ.error || bySupplierQ.error || byItemQ.error

  return (
    <div>
      <PageHeader title="تقارير المشتريات" />

      <Card className="mb-6">
        <div className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">من تاريخ</label>
            <input
              type="date"
              className="input max-w-[180px]"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">إلى تاريخ</label>
            <input
              type="date"
              className="input max-w-[180px]"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <KpiCard label="إجمالي المشتريات" value={totalPurchases.toLocaleString('en-US', { maximumFractionDigits: 2 })} tone="default" />
        <KpiCard label="عدد الأوامر" value={String(totalOrders)} tone="success" />
        <KpiCard label="إجمالي الكميات" value={totalQty.toLocaleString('en-US', { maximumFractionDigits: 2 })} tone="warning" />
      </div>

      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 px-4 pt-4">المشتريات الشهرية</h2>
        <div className="p-2">
          {summaryQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !summaryQ.data || summaryQ.data.length === 0 ? (
            <EmptyState message="لا توجد مشتريات في هذه الفترة" />
          ) : (
            <Table>
              <thead>
                <tr><Th>الفترة</Th><Th>عدد الأوامر</Th><Th>إجمالي القيمة</Th><Th>إجمالي الكميات</Th></tr>
              </thead>
              <tbody className="divide-y">
                {summaryQ.data.map((r) => (
                  <tr key={r.period} className="hover:bg-gray-50">
                    <Td className="font-mono">{r.period}</Td>
                    <Td>{r.total_orders}</Td>
                    <Td className="text-blue-700 font-medium">{r.total_amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                    <Td>{r.total_qty.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-gray-800 px-4 pt-4">المشتريات حسب المورد</h2>
        <div className="p-2">
          {bySupplierQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !bySupplierQ.data || bySupplierQ.data.length === 0 ? (
            <EmptyState message="لا توجد مشتريات في هذه الفترة" />
          ) : (
            <Table>
              <thead>
                <tr><Th>المورد</Th><Th>عدد الأوامر</Th><Th>إجمالي القيمة</Th></tr>
              </thead>
              <tbody className="divide-y">
                {bySupplierQ.data.map((r) => (
                  <tr key={r.supplier_uuid ?? 'unknown'} className="hover:bg-gray-50">
                    <Td>
                      {r.supplier_uuid ? (
                        <Link to={`/purchasing/suppliers/${r.supplier_uuid}`} className="text-blue-600 hover:underline">
                          <div className="font-mono text-xs">{r.supplier_code}</div>
                          <div className="text-xs text-gray-700">{r.supplier_name}</div>
                        </Link>
                      ) : <span className="text-gray-500">غير محدَّد</span>}
                    </Td>
                    <Td>{r.total_orders}</Td>
                    <Td className="text-blue-700 font-medium">{r.total_amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg font-bold text-gray-800 px-4 pt-4">المشتريات حسب الصنف</h2>
        <div className="p-2">
          {byItemQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !byItemQ.data || byItemQ.data.length === 0 ? (
            <EmptyState message="لا توجد مشتريات في هذه الفترة" />
          ) : (
            <Table>
              <thead>
                <tr><Th>الصنف</Th><Th>عدد الأوامر</Th><Th>إجمالي الكمية</Th><Th>إجمالي القيمة</Th></tr>
              </thead>
              <tbody className="divide-y">
                {byItemQ.data.map((r) => (
                  <tr key={r.item_uuid ?? 'unknown'} className="hover:bg-gray-50">
                    <Td>
                      {r.item_uuid ? (
                        <Link to={`/inventory/items/${r.item_uuid}`} className="text-blue-600 hover:underline">
                          <div className="font-mono text-xs">{r.item_code}</div>
                          <div className="text-xs text-gray-700">{r.item_name}</div>
                        </Link>
                      ) : <span className="text-gray-500">غير محدَّد</span>}
                    </Td>
                    <Td>{r.total_orders}</Td>
                    <Td>{r.total_qty.toLocaleString('en-US', { maximumFractionDigits: 4 })}</Td>
                    <Td className="text-blue-700 font-medium">{r.total_amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  )
}
