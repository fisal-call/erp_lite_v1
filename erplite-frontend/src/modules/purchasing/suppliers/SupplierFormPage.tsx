/** src/modules/purchasing/suppliers/SupplierFormPage.tsx
 *
 * Form for creating a new supplier. Mirrors CustomerFormPage exactly.
 * Uses RHF + Zod, shared UI primitives, Toast notifications.
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { purchasingApi } from '../api'
import { describeError } from '../../../api/client'
import { Card, PageHeader, useToast } from '../../../components/ui'
import { useState } from 'react'

const schema = z.object({
  supplier_code: z.string().min(1, 'الكود مطلوب').max(50, 'الكود طويل جداً'),
  supplier_name: z.string().min(1, 'الاسم مطلوب').max(200, 'الاسم طويل جداً'),
  phone: z.string().optional(),
  email: z.string().email('بريد إلكتروني غير صحيح').optional().or(z.literal('')),
})
type FormValues = z.infer<typeof schema>

export function SupplierFormPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [apiError, setApiError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: purchasingApi.createSupplier,
    onSuccess: (supplier) => {
      toast.success(`تم حفظ المورد: ${supplier.supplier_name}`)
      navigate(`/purchasing/suppliers/${supplier.uuid}`)
    },
    onError: (err) => {
      const msg = describeError(err)
      setApiError(msg)
      toast.error(msg)
    },
  })

  return (
    <div className="max-w-lg">
      <PageHeader title="مورد جديد" />

      {apiError && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md border border-red-200 mb-4">
          {apiError}
        </div>
      )}

      <Card>
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <Field label="كود المورد" error={errors.supplier_code?.message} required>
            <input className="input" {...register('supplier_code')} maxLength={50} />
          </Field>
          <Field label="اسم المورد" error={errors.supplier_name?.message} required>
            <input className="input" {...register('supplier_name')} maxLength={200} />
          </Field>
          <Field label="الهاتف">
            <input className="input" {...register('phone')} />
          </Field>
          <Field label="البريد الإلكتروني" error={errors.email?.message}>
            <input className="input ltr-text text-left" {...register('email')} />
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
              onClick={() => navigate('/purchasing/suppliers')}
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
