/**
 * src/modules/sales/customers/CustomerFormPage.tsx
 *
 * Form for creating a new customer. Uses RHF + Zod, shared UI primitives
 * (Card, PageHeader), and Toast notifications on success/error.
 *
 * Backend contract: POST /sales/customers with CustomerCreate schema.
 * On success, navigates to the new customer's detail page.
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { salesApi } from '../api'
import { describeError } from '../../../api/client'
import { Card, PageHeader, useToast } from '../../../components/ui'
import { useState } from 'react'

const schema = z.object({
  customer_code: z.string().min(1, 'الكود مطلوب').max(50, 'الكود طويل جداً'),
  customer_name: z.string().min(1, 'الاسم مطلوب').max(200, 'الاسم طويل جداً'),
  phone: z.string().optional(),
  email: z.string().email('بريد إلكتروني غير صحيح').optional().or(z.literal('')),
  credit_limit: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function CustomerFormPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [apiError, setApiError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: salesApi.createCustomer,
    onSuccess: (customer) => {
      toast.success(`تم حفظ العميل: ${customer.customer_name}`)
      navigate(`/sales/customers/${customer.uuid}`)
    },
    onError: (err) => {
      const msg = describeError(err)
      setApiError(msg)
      toast.error(msg)
    },
  })

  function onSubmit(values: FormValues) {
    setApiError(null)
    const creditLimit = values.credit_limit ? Number(values.credit_limit) : undefined
    if (creditLimit !== undefined && creditLimit < 0) {
      setApiError('حد الائتمان لا يمكن أن يكون سالباً')
      return
    }
    // Convert empty strings to null so backend Pydantic EmailStr | None / str | None
    // doesn't 422 on empty email (and to keep data quality consistent for phone).
    mutation.mutate({
      customer_code: values.customer_code,
      customer_name: values.customer_name,
      phone: values.phone?.trim() || null,
      email: values.email?.trim() || null,
      credit_limit: creditLimit ?? null,
    })
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="عميل جديد" />

      {apiError && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md border border-red-200 mb-4">
          {apiError}
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="كود العميل" error={errors.customer_code?.message} required>
            <input className="input" {...register('customer_code')} maxLength={50} />
          </Field>
          <Field label="اسم العميل" error={errors.customer_name?.message} required>
            <input className="input" {...register('customer_name')} maxLength={200} />
          </Field>
          <Field label="الهاتف">
            <input className="input" {...register('phone')} />
          </Field>
          <Field label="البريد الإلكتروني" error={errors.email?.message}>
            <input className="input ltr-text text-left" {...register('email')} />
          </Field>
          <Field label="حد الائتمان">
            <input type="number" step="0.01" className="input" {...register('credit_limit')} />
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
              onClick={() => navigate('/sales/customers')}
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
