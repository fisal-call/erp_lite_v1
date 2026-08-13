/**
 * src/modules/purchasing/suppliers/SupplierEditPage.tsx
 *
 * Edit form for an existing supplier. Uses `PATCH /purchasing/suppliers/{uuid}`
 * with `expected_version_no` (PDR-001 optimistic locking). On 409 (stale
 * version), refetches the supplier and shows the new version.
 *
 * `supplier_code` is NOT editable (backend does not accept it on PATCH).
 *
 * Mirrors CustomerEditPage exactly. Created 2026-08-10 — was a documented
 * P4 gap in BACKEND_REQUIRED.md (backend now exposes PATCH /purchasing/suppliers).
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { purchasingApi } from '../api'
import type { SupplierUpdateInput } from '../types'
import { ApiError, describeError } from '../../../api/client'
import { Card, PageHeader, ErrorState, Spinner } from '../../../components/ui'

const schema = z.object({
  supplier_name: z.string().min(1, 'الاسم مطلوب').max(200, 'الاسم طويل جداً'),
  phone: z.string().optional(),
  email: z.string().email('بريد إلكتروني غير صحيح').optional().or(z.literal('')),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

export function SupplierEditPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState<string | null>(null)
  const [conflictNotice, setConflictNotice] = useState<string | null>(null)

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['supplier', uuid],
    queryFn: () => purchasingApi.getSupplier(uuid!),
    enabled: !!uuid,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Pre-fill the form once the supplier loads.
  useEffect(() => {
    if (supplier) {
      reset({
        supplier_name: supplier.supplier_name,
        phone: supplier.phone ?? '',
        email: supplier.email ?? '',
        is_active: supplier.is_active,
      })
    }
  }, [supplier, reset])

  const mutation = useMutation({
    mutationFn: (values: SupplierUpdateInput) => purchasingApi.updateSupplier(uuid!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', uuid] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      navigate(`/purchasing/suppliers/${uuid}`)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflictNotice('تم تعديل هذا المورد من مستخدم آخر — جاري إعادة تحميل البيانات')
        queryClient.invalidateQueries({ queryKey: ['supplier', uuid] })
      } else {
        setApiError(describeError(err))
      }
    },
  })

  function onSubmit(values: FormValues) {
    setApiError(null)
    setConflictNotice(null)
    if (!supplier) return
    const payload: SupplierUpdateInput = {
      supplier_name: values.supplier_name,
      phone: values.phone || null,
      email: values.email || null,
      is_active: values.is_active,
      expected_version_no: supplier.version_no,
    }
    mutation.mutate(payload)
  }

  if (isLoading) return <Spinner />
  if (!supplier) return <ErrorState message="المورد غير موجود" />

  return (
    <div className="max-w-lg">
      <PageHeader title={`تعديل المورد: ${supplier.supplier_name}`} />

      {conflictNotice && (
        <div className="bg-amber-50 text-amber-800 text-sm p-3 rounded-md border border-amber-200 mb-4">
          {conflictNotice}
        </div>
      )}
      {apiError && <div className="mb-4"><ErrorState message={apiError} /></div>}

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-gray-700">كود المورد</label>
            <input className="input bg-gray-100" value={supplier.supplier_code} disabled />
            <p className="text-xs text-gray-400 mt-1">لا يمكن تعديل الكود بعد الإنشاء</p>
          </div>
          <Field label="اسم المورد" error={errors.supplier_name?.message}>
            <input className="input" {...register('supplier_name')} />
          </Field>
          <Field label="الهاتف">
            <input className="input" {...register('phone')} />
          </Field>
          <Field label="البريد الإلكتروني" error={errors.email?.message}>
            <input className="input ltr-text text-left" {...register('email')} />
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
              onClick={() => navigate(`/purchasing/suppliers/${uuid}`)}
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
