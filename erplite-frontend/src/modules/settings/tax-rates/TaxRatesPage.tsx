/**
 * src/modules/settings/tax-rates/TaxRatesPage.tsx
 *
 * Read-only list of tax rates (core.tax_rate table).
 *
 * NOTE: This is a simple tax_rate table (tax_name + tax_percent), NOT a full
 * tax engine. There is no tax mapping to items/customers/suppliers yet.
 * For full ERP tax functionality (tax rules, mapping, exemptions), see
 * docs/DECISIONS_PENDING.md.
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

export function TaxRatesPage() {
  const { data: rates, isLoading, error } = useQuery({
    queryKey: ['tax-rates'],
    queryFn: reportingApi.listTaxRates,
  })

  return (
    <div>
      <PageHeader title="النسب الضريبية" />

      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
        <strong>ملاحظة:</strong> هذا عرض للنسب الضريبية البسيطة (اسم + نسبة) من
        <code className="mx-1 px-1 bg-amber-100 rounded">core.tax_rate</code> —
        وليس محرك ضرائب كامل. لا يوجد حالياً ربط بين النسب والأصناف/العملاء/الموردين،
        ولا توجد قواعد ضريبية معقدة. راجع
        <code className="mx-1 px-1 bg-amber-100 rounded">DECISIONS_PENDING.md</code>
        للمزيد.
      </div>

      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : rates && rates.length === 0 ? (
        <Table>
          <thead><tr><Th>الاسم</Th><Th>النسبة</Th><Th>الحالة</Th></tr></thead>
          <tbody><tr><td colSpan={3}><EmptyState message="لا توجد نسب ضريبية مسجَّلة" /></td></tr></tbody>
        </Table>
      ) : rates ? (
        <Table>
          <thead>
            <tr>
              <Th>الاسم</Th>
              <Th>النسبة</Th>
              <Th>الحالة</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rates.map((r) => (
              <tr key={r.uuid} className="hover:bg-gray-50">
                <Td className="font-medium text-gray-800">{r.tax_name}</Td>
                <Td className="text-gray-700">{r.tax_percent.toLocaleString('en-US', { maximumFractionDigits: 4 })}%</Td>
                <Td><BooleanBadge value={r.is_active} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </div>
  )
}
