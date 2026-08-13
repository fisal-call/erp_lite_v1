/**
 * src/modules/inventory/categories/ItemCategoriesPage.tsx
 *
 * List + inline create form for item categories. Wires `listItemCategories` +
 * `createItemCategory` (both existed in api.ts but were unused before this
 * audit — ItemFormPage already used listItemCategories to populate the
 * dropdown, but no UI existed to actually manage categories).
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
import type { ItemCategory } from '../api'

export function ItemCategoriesPage() {
  const queryClient = useQueryClient()
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['item-categories'],
    queryFn: inventoryApi.listItemCategories,
  })

  const [name, setName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => inventoryApi.createItemCategory(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] })
      setName('')
      setFormError(null)
    },
    onError: (err) => setFormError(describeError(err)),
  })

  const { sortKey, sortDir, toggleSort, sortData } = useSort<ItemCategory>('category_name', 'asc')
  const sorted = sortData(categories ?? [], (c) => c[sortKey as keyof ItemCategory] ?? '')

  return (
    <div>
      <PageHeader title="فئات الأصناف" />

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Table>
              <thead>
                <tr>
                  <Th>الاسم</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <Td><Skeleton className="h-4 w-32" /></Td>
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
          {categories && categories.length === 0 ? (
            <Card><EmptyState message="لا توجد فئات بعد" /></Card>
          ) : (
            <Table>
              <thead>
                <tr>
                  <SortableTh label="الاسم" sortKey="category_name" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="الحالة" sortKey="is_active" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((c) => (
                  <tr key={c.uuid} className="hover:bg-gray-50">
                    <Td className="font-medium text-gray-800">{c.category_name}</Td>
                    <Td>
                      <span
                        className={`text-xs ${
                          c.is_active ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {c.is_active ? 'نشط' : 'موقوف'}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        <Card>
          <h2 className="font-bold mb-3 text-gray-800">فئة جديدة</h2>
          {formError && <div className="mb-3"><ErrorState message={formError} /></div>}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) {
                setFormError('اسم الفئة مطلوب')
                return
              }
              mutation.mutate()
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-sm mb-1 text-gray-700">اسم الفئة</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={150}
                required
              />
            </div>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-blue-600 text-white rounded-md py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'جاري الحفظ...' : 'إضافة الفئة'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  )
}
