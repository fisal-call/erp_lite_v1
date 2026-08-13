/**
 * src/modules/reports/sales/SalesReportsPage.tsx
 *
 * Sales analytics — uses /reporting/sales-summary, /reporting/sales-by-customer,
 * /reporting/sales-by-item. All endpoints now exist.
 *
 * Date filter is applied to all three queries via date_from / date_to.
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

export function SalesReportsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useUrlState('from', firstOfMonth)
  const [dateTo, setDateTo] = useUrlState('to', today)

  const summaryQ = useQuery({
    queryKey: ['sales-summary', dateFrom, dateTo],
    queryFn: () => reportingApi.getSalesSummary('month', dateFrom, dateTo),
  })
  const byCustomerQ = useQuery({
    queryKey: ['sales-by-customer', dateFrom, dateTo],
    queryFn: () => reportingApi.getSalesByCustomer(dateFrom, dateTo),
  })
  const byItemQ = useQuery({
    queryKey: ['sales-by-item', dateFrom, dateTo],
    queryFn: () => reportingApi.getSalesByItem(dateFrom, dateTo),
  })

  const totalSales = summaryQ.data?.reduce((s, r) => s + r.total_amount, 0) ?? 0
  const totalOrders = summaryQ.data?.reduce((s, r) => s + r.total_orders, 0) ?? 0
  const totalQty = summaryQ.data?.reduce((s, r) => s + r.total_qty, 0) ?? 0

  const error = summaryQ.error || byCustomerQ.error || byItemQ.error

  return (
    <div>
      <PageHeader title="تقارير المبيعات" />

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
        <KpiCard label="إجمالي المبيعات" value={totalSales.toLocaleString('en-US', { maximumFractionDigits: 2 })} tone="default" />
        <KpiCard label="عدد الأوامر" value={String(totalOrders)} tone="success" />
        <KpiCard label="إجمالي الكميات" value={totalQty.toLocaleString('en-US', { maximumFractionDigits: 2 })} tone="warning" />
      </div>

      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {/* Sales by month */}
      <Card className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 px-4 pt-4">المبيعات الشهرية</h2>
        <div className="p-2">
          {summaryQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !summaryQ.data || summaryQ.data.length === 0 ? (
            <EmptyState message="لا توجد مبيعات في هذه الفترة" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>الفترة</Th>
                  <Th>عدد الأوامر</Th>
                  <Th>إجمالي القيمة</Th>
                  <Th>إجمالي الكميات</Th>
                </tr>
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

      {/* Sales by customer */}
      <Card className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 px-4 pt-4">المبيعات حسب العميل</h2>
        <div className="p-2">
          {byCustomerQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !byCustomerQ.data || byCustomerQ.data.length === 0 ? (
            <EmptyState message="لا توجد مبيعات في هذه الفترة" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>العميل</Th>
                  <Th>عدد الأوامر</Th>
                  <Th>إجمالي القيمة</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byCustomerQ.data.map((r) => (
                  <tr key={r.customer_uuid ?? 'unknown'} className="hover:bg-gray-50">
                    <Td>
                      {r.customer_uuid ? (
                        <Link to={`/sales/customers/${r.customer_uuid}`} className="text-blue-600 hover:underline">
                          <div className="font-mono text-xs">{r.customer_code}</div>
                          <div className="text-xs text-gray-700">{r.customer_name}</div>
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

      {/* Sales by item */}
      <Card>
        <h2 className="text-lg font-bold text-gray-800 px-4 pt-4">المبيعات حسب الصنف</h2>
        <div className="p-2">
          {byItemQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !byItemQ.data || byItemQ.data.length === 0 ? (
            <EmptyState message="لا توجد مبيعات في هذه الفترة" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>الصنف</Th>
                  <Th>إجمالي الكمية</Th>
                  <Th>إجمالي القيمة</Th>
                </tr>
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
