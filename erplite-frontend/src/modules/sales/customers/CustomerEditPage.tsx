/**
 * src/modules/sales/customers/CustomerEditPage.tsx
 *
 * Edit form for an existing customer. Uses `PATCH /sales/customers/{uuid}`
 * with `expected_version_no` (PDR-001 optimistic locking). On 409 (stale
 * version), refetches the customer and shows the new version.
 *
 * `customer_code` is NOT editable (backend does not accept it on PATCH).
 *
 * Uses react-hook-form + Zod, Arabic error messages, and a confirm dialog
 * is unnecessary here because PATCH is non-destructive (creates no new
 * document, only updates fields).
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { salesApi } from '../api'
import type { CustomerUpdateInput } from '../types'
import { ApiError, describeError } from '../../../api/client'
import { Card, PageHeader, ErrorState, Spinner, useToast } from '../../../components/ui'

const schema = z.object({
  customer_name: z.string().min(1, 'الاسم مطلوب').max(200, 'الاسم طويل جداً'),
  phone: z.string().optional(),
  email: z.string().email('بريد إلكتروني غير صحيح').optional().or(z.literal('')),
  credit_limit: z.string().optional(),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

export function CustomerEditPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [apiError, setApiError] = useState<string | null>(null)
  const [conflictNotice, setConflictNotice] = useState<string | null>(null)

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', uuid],
    queryFn: () => salesApi.getCustomer(uuid!),
    enabled: !!uuid,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Pre-fill the form once the customer loads.
  useEffect(() => {
    if (customer) {
      reset({
        customer_name: customer.customer_name,
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        credit_limit: customer.credit_limit ?? '',
        is_active: customer.is_active,
      })
    }
  }, [customer, reset])

  const mutation = useMutation({
    mutationFn: (values: CustomerUpdateInput) => salesApi.updateCustomer(uuid!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', uuid] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('تم حفظ التعديلات')
      navigate(`/sales/customers/${uuid}`)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflictNotice('تم تعديل هذا العميل من مستخدم آخر — جاري إعادة تحميل البيانات')
        queryClient.invalidateQueries({ queryKey: ['customer', uuid] })
      } else {
        setApiError(describeError(err))
      }
    },
  })

  function onSubmit(values: FormValues) {
    setApiError(null)
    setConflictNotice(null)
    const creditLimit = values.credit_limit ? Number(values.credit_limit) : null
    if (creditLimit !== null && creditLimit < 0) {
      setApiError('حد الائتمان لا يمكن أن يكون سالباً')
      return
    }
    if (!customer) return
    const payload: CustomerUpdateInput = {
      customer_name: values.customer_name,
      phone: values.phone || null,
      email: values.email || null,
      credit_limit: creditLimit,
      is_active: values.is_active,
      expected_version_no: customer.version_no,
    }
    mutation.mutate(payload)
  }

  if (isLoading) return <Spinner />
  if (!customer) return <ErrorState message="العميل غير موجود" />

  return (
    <div className="max-w-lg">
      <PageHeader title={`تعديل العميل: ${customer.customer_name}`} />

      {conflictNotice && (
        <div className="bg-amber-50 text-amber-800 text-sm p-3 rounded-md border border-amber-200 mb-4">
          {conflictNotice}
        </div>
      )}
      {apiError && <div className="mb-4"><ErrorState message={apiError} /></div>}

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-gray-700">كود العميل</label>
            <input className="input bg-gray-100" value={customer.customer_code} disabled />
            <p className="text-xs text-gray-400 mt-1">لا يمكن تعديل الكود بعد الإنشاء</p>
          </div>
          <Field label="اسم العميل" error={errors.customer_name?.message}>
            <input className="input" {...register('customer_name')} />
          </Field>
          <Field label="الهاتف">
            <input className="input" {...register('phone')} />
          </Field>
          <Field label="البريد الإلكتروني" error={errors.email?.message}>
            <input className="input" {...register('email')} />
          </Field>
          <Field label="حد الائتمان">
            <input type="number" step="0.01" className="input" {...register('credit_limit')} />
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
              onClick={() => navigate(`/sales/customers/${uuid}`)}
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
