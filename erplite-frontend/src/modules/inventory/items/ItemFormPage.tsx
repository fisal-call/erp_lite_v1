/**
 * src/modules/inventory/items/ItemFormPage.tsx
 *
 * Form for creating a new inventory item. Uses React Hook Form + Zod for
 * validation, the shared `Card` + `PageHeader` primitives, and Toast
 * notifications on success/error.
 *
 * Backend contract (per app/modules/inventory/schemas.py ItemCreate):
 *   - item_code (required, max 50)
 *   - item_name (required, max 255)
 *   - item_category_uuid (required — fetched from /inventory/item-categories)
 *   - base_uom_uuid (required — fetched from /core/units-of-measure)
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { inventoryApi, type ItemCategory } from '../api'
import { coreOrgApi, type UnitOfMeasure } from '../../core-org/api'
import { describeError } from '../../../api/client'
import {
  Card,
  ErrorState,
  PageHeader,
  useToast,
} from '../../../components/ui'

const schema = z.object({
  item_code: z.string().min(1, 'كود الصنف مطلوب').max(50, 'الكود طويل جداً (50 كحد أقصى)'),
  item_name: z.string().min(1, 'اسم الصنف مطلوب').max(255, 'الاسم طويل جداً (255 كحد أقصى)'),
  item_category_uuid: z.string().min(1, 'اختر الفئة'),
  base_uom_uuid: z.string().min(1, 'اختر وحدة القياس'),
})
type FormValues = z.infer<typeof schema>

export function ItemFormPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [categories, setCategories] = useState<ItemCategory[]>([])
  const [uoms, setUoms] = useState<UnitOfMeasure[]>([])
  const [lookupError, setLookupError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch categories and UoMs in parallel; surface any failure as an
    // inline error banner so the user knows the dropdowns are empty
    // because the API call failed (not because there is no data).
    let cancelled = false
    Promise.all([
      inventoryApi.listItemCategories(),
      coreOrgApi.listUnitsOfMeasure(),
    ])
      .then(([cats, uList]) => {
        if (cancelled) return
        setCategories(cats)
        setUoms(uList)
      })
      .catch((err) => {
        if (cancelled) return
        setLookupError(describeError(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { item_code: '', item_name: '', item_category_uuid: '', base_uom_uuid: '' },
  })

  const mutation = useMutation({
    mutationFn: inventoryApi.createItem,
    onSuccess: (item) => {
      // Invalidate the list cache so /inventory/items shows the new item
      // immediately on back-navigation (otherwise stale list until remount).
      queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success(`تم حفظ الصنف: ${item.item_name}`)
      navigate(`/inventory/items/${item.uuid}`)
    },
    onError: (err) => toast.error(describeError(err)),
  })

  function onSubmit(values: FormValues) {
    mutation.mutate(values)
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="صنف جديد" />

      <Card>
        {lookupError && (
          <div className="mb-4">
            <ErrorState message={lookupError} />
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="كود الصنف" error={errors.item_code?.message} required>
            <input className="input" {...register('item_code')} maxLength={50} />
          </Field>
          <Field label="اسم الصنف" error={errors.item_name?.message} required>
            <input className="input" {...register('item_name')} maxLength={255} />
          </Field>
          <Field label="الفئة" error={errors.item_category_uuid?.message} required>
            <select className="input" {...register('item_category_uuid')}>
              <option value="">— اختر —</option>
              {categories.map((c) => (
                <option key={c.uuid} value={c.uuid}>
                  {c.category_name}
                </option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                لا توجد فئات بعد — أنشئ فئة من صفحة «فئات الأصناف» أولاً.
              </p>
            )}
          </Field>
          <Field label="وحدة القياس" error={errors.base_uom_uuid?.message} required>
            <select className="input" {...register('base_uom_uuid')}>
              <option value="">— اختر —</option>
              {uoms.map((u) => (
                <option key={u.uuid} value={u.uuid}>
                  {u.uom_name}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-md py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/inventory/items')}
              className="px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm mb-1 text-gray-700">
        {label}
        {required && <span className="text-rose-600 mr-1">*</span>}
      </label>
      {children}
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  )
}
