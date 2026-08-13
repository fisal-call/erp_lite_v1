/**
 * src/modules/inventory/items/ItemEditPage.tsx
 *
 * Edit form for an existing item. Uses `PATCH /inventory/items/{uuid}` with
 * `expected_version_no` (PDR-001 optimistic locking). On 409 (stale version),
 * refetches the item and shows the new version.
 *
 * `item_code`, `item_category_uuid`, `base_uom_uuid` are NOT editable — see
 * backend ItemUpdate schema for why (changing category/UoM mid-life has
 * cascading effects on stock valuation).
 *
 * Created 2026-08-10 — was a P4 gap in BACKEND_REQUIRED.md.
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { inventoryApi, type ItemUpdateInput } from '../api'
import { ApiError, describeError } from '../../../api/client'
import { Card, PageHeader, ErrorState, Spinner } from '../../../components/ui'

const schema = z.object({
  item_name: z.string().min(1, 'الاسم مطلوب').max(255, 'الاسم طويل جداً'),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

export function ItemEditPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState<string | null>(null)
  const [conflictNotice, setConflictNotice] = useState<string | null>(null)

  const { data: item, isLoading } = useQuery({
    queryKey: ['item', uuid],
    queryFn: () => inventoryApi.getItem(uuid!),
    enabled: !!uuid,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (item) {
      reset({
        item_name: item.item_name,
        is_active: item.is_active,
      })
    }
  }, [item, reset])

  const mutation = useMutation({
    mutationFn: (values: ItemUpdateInput) => inventoryApi.updateItem(uuid!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', uuid] })
      queryClient.invalidateQueries({ queryKey: ['items'] })
      navigate(`/inventory/items/${uuid}`)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflictNotice('تم تعديل هذا الصنف من مستخدم آخر — جاري إعادة تحميل البيانات')
        queryClient.invalidateQueries({ queryKey: ['item', uuid] })
      } else {
        setApiError(describeError(err))
      }
    },
  })

  function onSubmit(values: FormValues) {
    setApiError(null)
    setConflictNotice(null)
    if (!item) return
    const payload: ItemUpdateInput = {
      item_name: values.item_name,
      is_active: values.is_active,
      expected_version_no: item.version_no,
    }
    mutation.mutate(payload)
  }

  if (isLoading) return <Spinner />
  if (!item) return <ErrorState message="الصنف غير موجود" />

  return (
    <div className="max-w-lg">
      <PageHeader title={`تعديل الصنف: ${item.item_name}`} />

      {conflictNotice && (
        <div className="bg-amber-50 text-amber-800 text-sm p-3 rounded-md border border-amber-200 mb-4">
          {conflictNotice}
        </div>
      )}
      {apiError && <div className="mb-4"><ErrorState message={apiError} /></div>}

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-gray-700">كود الصنف</label>
            <input className="input bg-gray-100" value={item.item_code} disabled />
            <p className="text-xs text-gray-400 mt-1">لا يمكن تعديل الكود بعد الإنشاء</p>
          </div>
          <Field label="اسم الصنف" error={errors.item_name?.message}>
            <input className="input" {...register('item_name')} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('is_active')} />
            نشط
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-md py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/inventory/items/${uuid}`)}
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
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm mb-1 text-gray-700">{label}</label>
      {children}
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  )
}
