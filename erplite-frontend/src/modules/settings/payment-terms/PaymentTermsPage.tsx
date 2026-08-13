/**
 * src/modules/settings/payment-terms/PaymentTermsPage.tsx
 *
 * Read-only list of payment terms (core.payment_term table).
 */
import { useQuery } from '@tanstack/react-query'
import { reportingApi } from '../../reporting/api'
import {
  BooleanBadge,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Table,
  Th,
  Td,
} from '../../../components/ui'

export function PaymentTermsPage() {
  const { data: terms, isLoading, error } = useQuery({
    queryKey: ['payment-terms'],
    queryFn: reportingApi.listPaymentTerms,
  })

  return (
    <div>
      <PageHeader title="شروط السداد" />

      <p className="text-sm text-gray-600 mb-4">
        شروط السداد تُستخدم مع العملاء والموردين لتحديد تاريخ الاستحقاق. لا توجد
        واجهة لإنشائها بعد — مسجَّل في TODO.
      </p>

      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : terms && terms.length === 0 ? (
        <Table>
          <thead><tr><Th>الاسم</Th><Th>أيام السداد</Th><Th>الحالة</Th></tr></thead>
          <tbody><tr><td colSpan={3}><EmptyState message="لا توجد شروط سداد مسجَّلة بعد" /></td></tr></tbody>
        </Table>
      ) : terms ? (
        <Table>
          <thead>
            <tr>
              <Th>الاسم</Th>
              <Th>أيام السداد</Th>
              <Th>الحالة</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {terms.map((t) => (
              <tr key={t.uuid} className="hover:bg-gray-50">
                <Td className="font-medium text-gray-800">{t.term_name}</Td>
                <Td className="text-gray-700">{t.days_due} يوم</Td>
                <Td><BooleanBadge value={t.is_active} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </div>
  )
}
