/**
 * src/modules/settings/fiscal/FiscalSettingsPage.tsx
 *
 * Read-only view of fiscal years and their periods. The DB has core.fiscal_year
 * and core.fiscal_period (no uuid on fiscal_period — composite key with fiscal_year_id).
 *
 * No create/update endpoints yet (recorded in docs/TODO.md). Currently the only
 * way to seed fiscal data is via SQL migrations / scripts/seed_fiscal_periods.py.
 */
import { useQuery } from '@tanstack/react-query'
import { reportingApi } from '../../reporting/api'
import {
  BooleanBadge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Table,
  Th,
  Td,
  useUrlState,
} from '../../../components/ui'

export function FiscalSettingsPage() {
  // Persist the selected year in the URL (?year=) so refresh / share / back
  // restores the same view. Empty string means "no year selected".
  const [selectedYear, setSelectedYear] = useUrlState('year', '')
  const yearsQ = useQuery({ queryKey: ['fiscal-years'], queryFn: reportingApi.listFiscalYears })
  const periodsQ = useQuery({
    queryKey: ['fiscal-periods', selectedYear || undefined],
    queryFn: () => reportingApi.listFiscalPeriods(selectedYear || undefined),
    enabled: !!selectedYear,
  })

  const years = yearsQ.data ?? []
  const periods = periodsQ.data ?? []

  return (
    <div>
      <PageHeader title="السنوات والفترات المالية" />

      <p className="text-sm text-gray-600 mb-4">
        السنوات المالية تُنشأ عبر إعداد النظام أو سكربتات الإعداد. لا توجد واجهة لإنشائها
        أو تعديلها بعد — مسجَّل في TODO.
      </p>

      {yearsQ.error && <div className="mb-4"><ErrorState error={yearsQ.error} /></div>}
      {periodsQ.error && <div className="mb-4"><ErrorState error={periodsQ.error} /></div>}

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 px-4 pt-4">السنوات المالية</h2>
        <div className="p-2">
          {yearsQ.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : years.length === 0 ? (
            <EmptyState message="لا توجد سنوات مالية مسجَّلة" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>السنة</Th>
                  <Th>من</Th>
                  <Th>إلى</Th>
                  <Th>الحالة</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {years.map((y) => (
                  <tr
                    key={y.uuid}
                    className={`hover:bg-gray-50 cursor-pointer ${selectedYear === y.uuid ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedYear(selectedYear === y.uuid ? '' : y.uuid)}
                  >
                    <Td className="font-bold text-gray-800">{y.year_label}</Td>
                    <Td className="text-gray-700">{y.start_date}</Td>
                    <Td className="text-gray-700">{y.end_date}</Td>
                    <Td>
                      <BooleanBadge value={!y.is_closed} trueLabel="مفتوحة" falseLabel="مغلقة" />
                    </Td>
                    <Td className="text-xs text-blue-600">
                      {selectedYear === y.uuid ? 'إخفاء الفترات' : 'عرض الفترات'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {selectedYear && (
        <Card>
          <h2 className="text-lg font-bold text-gray-800 px-4 pt-4">
            فترات السنة: {years.find((y) => y.uuid === selectedYear)?.year_label ?? ''}
          </h2>
          <div className="p-2">
            {periodsQ.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : periods.length === 0 ? (
              <EmptyState message="لا توجد فترات مالية لهذه السنة" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>رقم الفترة</Th>
                    <Th>من</Th>
                    <Th>إلى</Th>
                    <Th>الحالة</Th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {periods.map((p) => (
                    <tr key={`${p.fiscal_year_uuid}-${p.period_number}`} className="hover:bg-gray-50">
                      <Td className="font-bold">#{p.period_number}</Td>
                      <Td className="text-gray-700">{p.start_date}</Td>
                      <Td className="text-gray-700">{p.end_date}</Td>
                      <Td>
                        <BooleanBadge value={!p.is_closed} trueLabel="مفتوحة" falseLabel="مغلقة" />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
