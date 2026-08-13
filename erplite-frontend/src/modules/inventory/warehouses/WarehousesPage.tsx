/**
 * src/modules/inventory/warehouses/WarehousesPage.tsx
 *
 * List + inline create form for warehouses. Wires `listWarehouses` +
 * `createWarehouse` (both existed in api.ts but were unused before this
 * audit — the backend exposes both endpoints and they were just never
 * surfaced in the UI).
 *
 * Per backend: `allow_negative_stock` defaults to false (BD-001).
 * `branch_uuid` is accepted by the backend DTO but NOT yet persisted
 * (documented gap), so we don't expose it in the form.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../api'
import { describeError } from '../../../api/client'
import {
  Card,
  PageHeader,
  Skeleton,
  ErrorState,
  EmptyState,
  SortableTh,
  Table,
  Th,
  Td,
  useSort,
} from '../../../components/ui'
import type { Warehouse } from '../api'

export function WarehousesPage() {
  const queryClient = useQueryClient()
  const { data: warehouses, isLoading, error } = useQuery({
    queryKey: ['warehouses'],
    queryFn: inventoryApi.listWarehouses,
  })

  const [name, setName] = useState('')
  const [allowNegative, setAllowNegative] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      inventoryApi.createWarehouse({
        warehouse_name: name,
        allow_negative_stock: allowNegative,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      setName('')
      setAllowNegative(false)
      setFormError(null)
    },
    onError: (err) => setFormError(describeError(err)),
  })

  const { sortKey, sortDir, toggleSort, sortData } = useSort<Warehouse>('warehouse_name', 'asc')
  const sorted = sortData(warehouses ?? [], (w) => w[sortKey as keyof Warehouse] ?? '')

  return (
    <div>
      <PageHeader title="المخازن" />

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Table>
              <thead>
                <tr>
                  <Th>الاسم</Th>
                  <Th>السماح بالسالب</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <Td><Skeleton className="h-4 w-32" /></Td>
                    <Td><Skeleton className="h-5 w-14 rounded-full" /></Td>
                    <Td><Skeleton className="h-5 w-14 rounded-full" /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <Card><Skeleton className="h-64 w-full" /></Card>
        </div>
      )}
      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {warehouses && warehouses.length === 0 ? (
            <Card><EmptyState message="لا توجد مخازن بعد" /></Card>
          ) : (
            <Table>
              <thead>
                <tr>
                  <SortableTh label="الاسم" sortKey="warehouse_name" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="السماح بالسالب" sortKey="allow_negative_stock" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="الحالة" sortKey="is_active" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((w) => (
                  <tr key={w.uuid} className="hover:bg-gray-50">
                    <Td className="font-medium text-gray-800">{w.warehouse_name}</Td>
                    <Td>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          w.allow_negative_stock
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {w.allow_negative_stock ? 'مسموح' : 'ممنوع'}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className={`text-xs ${
                          w.is_active ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {w.is_active ? 'نشط' : 'موقوف'}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        <Card>
          <h2 className="font-bold mb-3 text-gray-800">مخزن جديد</h2>
          {formError && <div className="mb-3"><ErrorState message={formError} /></div>}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) {
                setFormError('اسم المخزن مطلوب')
                return
              }
              mutation.mutate()
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-sm mb-1 text-gray-700">اسم المخزن</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowNegative}
                onChange={(e) => setAllowNegative(e.target.checked)}
              />
              السماح بالمخزون السالب (BD-001)
            </label>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-blue-600 text-white rounded-md py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'جاري الحفظ...' : 'إضافة المخزن'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  )
}
