/**
 * src/modules/purchasing/orders/PurchaseOrderDetailPage.tsx
 *
 * Mirrors SalesOrderDetailPage. Resolves supplier UUID → name and item
 * UUIDs → names so users see human-readable text instead of raw UUIDs.
 *
 * Features:
 *   - ConfirmDialog before submit (sensitive operation)
 *   - Line totals + grand total
 *   - Responsive table (overflow-x-auto on mobile)
 *   - 409 (stale version) auto-refetch + Arabic notice
 *   - Print button (window.print)
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { purchasingApi } from '../api'
import { inventoryApi, type Item } from '../../inventory/api'
import { StatusBadge } from '../../../components/StatusBadge'
import { ApiError, describeError } from '../../../api/client'
import {
  Card,
  DetailField,
  ErrorState,
  PageHeader,
  Spinner,
  Table,
  Th,
  Td,
  ConfirmDialog,
  useToast,
} from '../../../components/ui'

export function PurchaseOrderDetailPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-order', uuid],
    queryFn: () => purchasingApi.getPurchaseOrder(uuid!),
    enabled: !!uuid,
  })

  // Fetch the supplier to display its name (the order only carries the UUID)
  const { data: supplier } = useQuery({
    queryKey: ['supplier', order?.supplier.uuid],
    queryFn: () => purchasingApi.getSupplier(order!.supplier.uuid),
    enabled: !!order?.supplier.uuid,
  })

  // Fetch items list to build a UUID → name lookup map.
  const { data: itemsList } = useQuery({
    queryKey: ['items'],
    queryFn: inventoryApi.listItems,
  })
  const itemMap = new Map<string, Item>(
    (itemsList ?? []).map((i) => [i.uuid, i]),
  )

  const submitMutation = useMutation({
    mutationFn: () => purchasingApi.submitPurchaseOrder(uuid!, order!.version_no),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', uuid] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      setConfirmOpen(false)
      toast.success('تم اعتماد أمر الشراء')
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setError('تم تعديل المستند من مستخدم آخر — جاري إعادة التحميل')
        queryClient.invalidateQueries({ queryKey: ['purchase-order', uuid] })
      } else {
        setError(describeError(err))
      }
      setConfirmOpen(false)
    },
  })

  if (isLoading) return <Spinner />
  if (!order) return <ErrorState message="المستند غير موجود" />

  const total = order.lines.reduce(
    (s, l) => s + Number(l.qty_ordered) * Number(l.rate),
    0,
  )

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`أمر شراء ${order.document_number}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              طباعة
            </button>
            <StatusBadge status={order.status} />
          </div>
        }
      />

      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      <Card className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          <DetailField label="رقم المستند" value={order.document_number} ltr />
          <DetailField label="التاريخ" value={order.document_date} ltr />
          <DetailField
            label="المورد"
            value={
              supplier ? (
                <Link
                  to={`/purchasing/suppliers/${supplier.uuid}`}
                  className="text-blue-600 hover:underline"
                >
                  {supplier.supplier_name}{' '}
                  <span className="text-xs text-gray-400 font-mono">
                    ({supplier.supplier_code})
                  </span>
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DetailField label="الحالة" value={<StatusBadge status={order.status} />} />
        </div>

        <Table>
          <thead>
            <tr>
              <Th>الصنف</Th>
              <Th>الكمية</Th>
              <Th>السعر</Th>
              <Th>الإجمالي</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {order.lines.map((line, i) => {
              const item = itemMap.get(line.item_uuid)
              return (
                <tr key={i}>
                  <Td>
                    {item ? (
                      <Link
                        to={`/inventory/items/${item.uuid}`}
                        className="text-blue-600 hover:underline"
                      >
                        {item.item_name}
                        <span className="text-xs text-gray-400 font-mono mr-2">
                          ({item.item_code})
                        </span>
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400 font-mono ltr-text">
                        {line.item_uuid}
                      </span>
                    )}
                  </Td>
                  <Td>{line.qty_ordered}</Td>
                  <Td>{line.rate}</Td>
                  <Td className="font-medium">
                    {(Number(line.qty_ordered) * Number(line.rate)).toFixed(2)}
                  </Td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <Td className="font-bold">الإجمالي الكلي</Td>
              <Td />
              <Td />
              <Td className="font-bold text-blue-700">{total.toFixed(2)}</Td>
            </tr>
          </tfoot>
        </Table>

        {order.status === 'draft' && (
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={submitMutation.isPending}
            className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitMutation.isPending ? 'جاري الاعتماد...' : 'اعتماد الأمر'}
          </button>
        )}
        {order.status !== 'draft' && (
          <p className="text-xs text-gray-400">المستند معتمد — لا يمكن تعديله.</p>
        )}
      </Card>

      <div className="mt-4">
        <Link to="/purchasing/orders" className="text-sm text-blue-600 hover:underline">
          ← العودة لقائمة أوامر الشراء
        </Link>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="تأكيد اعتماد أمر الشراء"
        description={
          <>
            سيتم اعتماد الأمر <strong>{order.document_number}</strong>. هذه العملية
            لا يمكن التراجع عنها — لن يكون التعديل متاحاً بعد الاعتماد.
          </>
        }
        confirmLabel="اعتماد"
        busy={submitMutation.isPending}
        onConfirm={() => submitMutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
