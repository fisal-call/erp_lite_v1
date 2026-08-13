/**
 * src/modules/inventory/items/ItemDetailPage.tsx
 *
 * Item detail view with stock movements tab.
 */
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { inventoryApi } from '../api'
import { reportingApi } from '../../reporting/api'
import {
  BooleanBadge,
  Card,
  DetailField,
  EmptyState,
  ErrorState,
  KpiCard,
  PageHeader,
  Skeleton,
  Spinner,
  Table,
  Th,
  Td,
} from '../../../components/ui'

type Tab = 'info' | 'movements' | 'balance'

const SOURCE_DOCTYPE_AR: Record<string, string> = {
  sales_order: 'أمر بيع',
  sales_delivery: 'تسليم بيع',
  purchase_receipt: 'استلام شراء',
  stock_adjustment: 'تسوية',
  stock_transfer: 'تحويل',
  sales_return: 'مرتجع بيع',
  purchase_return: 'مرتجع شراء',
}

export function ItemDetailPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const [tab, setTab] = useState<Tab>('info')

  const itemQ = useQuery({
    queryKey: ['item', uuid],
    queryFn: () => inventoryApi.getItem(uuid!),
    enabled: !!uuid,
  })
  // Always fetch movements + balance so the KPI strip on the info tab shows
  // accurate counts (previously gated on tab activation, which caused the
  // KPIs to read 0 on first load). Both queries are cached per-uuid by TanStack
  // Query so navigating between tabs is instant after the first fetch.
  const movementsQ = useQuery({
    queryKey: ['stock-movements', uuid],
    queryFn: () => reportingApi.listStockMovements({ item_uuid: uuid, limit: 100 }),
    enabled: !!uuid,
  })
  const balanceQ = useQuery({
    queryKey: ['stock-balance'],
    queryFn: inventoryApi.stockBalance,
    enabled: !!uuid,
  })

  if (itemQ.isLoading) return <Spinner />
  if (itemQ.error) return <ErrorState error={itemQ.error} />
  if (!itemQ.data) return <ErrorState message="الصنف غير موجود" />
  const item = itemQ.data

  // StockBalanceRead returns {item_code, item_name, warehouse_name, qty_on_hand}
  // — no item_uuid. Filter by item_code (the natural key) instead.
  const itemBalance = (balanceQ.data ?? []).filter((b) => b.item_code === item.item_code)
  const totalOnHand = itemBalance.reduce((s, b) => s + (b.qty_on_hand ?? 0), 0)

  return (
    <div>
      <PageHeader
        title={`الصنف: ${item.item_name}`}
        actions={
          <Link
            to={`/inventory/items/${uuid}/edit`}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700"
          >
            تعديل
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <KpiCard label="إجمالي المخزون" value={totalOnHand.toLocaleString('en-US', { maximumFractionDigits: 4 })} tone="default" />
        <KpiCard label="المخازن المتوفّر فيها" value={String(itemBalance.length)} tone="success" />
        <KpiCard label="حركات مسجَّلة" value={String(movementsQ.data?.length ?? 0)} tone="warning" />
      </div>

      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-1 overflow-x-auto" role="tablist">
          {([
            ['info', 'بيانات'],
            ['balance', `أرصدة المخازن (${itemBalance.length})`],
            ['movements', `حركات المخزون (${movementsQ.data?.length ?? 0})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 ${
                tab === key
                  ? 'border-blue-600 text-blue-700 font-medium'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'info' && (
        <Card className="space-y-1 max-w-2xl">
          <DetailField label="الكود" value={item.item_code} ltr />
          <DetailField label="الاسم" value={item.item_name} />
          <DetailField label="الحالة" value={<BooleanBadge value={item.is_active} />} />
          <DetailField label="تاريخ الإنشاء" value={item.created_at} ltr />
          <DetailField label="رقم الإصدار" value={String(item.version_no)} ltr />
        </Card>
      )}

      {tab === 'balance' && (
        <Card>
          <div className="p-2">
            {balanceQ.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : itemBalance.length === 0 ? (
              <EmptyState message="لا يوجد رصيد مسجَّل لهذا الصنف — تنتج الأرصدة من حركات المخزون" />
            ) : (
              <Table>
                <thead><tr><Th>المخزن</Th><Th>الرصيد المتاح</Th></tr></thead>
                <tbody className="divide-y">
                  {itemBalance.map((b, idx) => (
                    <tr key={`${b.warehouse_name}-${idx}`} className="hover:bg-gray-50">
                      <Td className="font-medium text-gray-800">{b.warehouse_name ?? '—'}</Td>
                      <Td className={`font-bold ${(b.qty_on_hand ?? 0) <= 0 ? 'text-rose-700' : 'text-green-700'}`}>
                        {(b.qty_on_hand ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>
      )}

      {tab === 'movements' && (
        <Card>
          <div className="p-2">
            {movementsQ.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !movementsQ.data || movementsQ.data.length === 0 ? (
              <EmptyState message="لا توجد حركات مخزون لهذا الصنف" />
            ) : (
              <Table>
                <thead><tr><Th>التاريخ</Th><Th>المخزن</Th><Th>الكمية</Th><Th>المصدر</Th></tr></thead>
                <tbody className="divide-y">
                  {movementsQ.data.map((m) => (
                    <tr key={m.uuid} className="hover:bg-gray-50">
                      <Td className="text-gray-700">{m.posting_date}</Td>
                      <Td className="text-gray-700">{m.warehouse_name ?? '—'}</Td>
                      <Td className={`font-bold ${m.qty_change > 0 ? 'text-green-700' : 'text-rose-700'}`}>
                        {m.qty_change > 0 ? '+' : ''}{m.qty_change.toLocaleString('en-US', { maximumFractionDigits: 4 })}
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
          </div>
        </Card>
      )}

      <div className="mt-4 flex gap-4">
        <Link to="/inventory/items" className="text-sm text-blue-600 hover:underline">
          ← العودة لقائمة الأصناف
        </Link>
      </div>
    </div>
  )
}
