/**
 * src/modules/finance/cash-bank/CashBankPage.tsx
 *
 * Read-only listing of cash accounts + banks + bank accounts.
 * The DB schema (accounting.cash_account / accounting.bank /
 * accounting.bank_account) supports these but no create/update endpoints
 * exist yet — recorded in docs/TODO.md.
 *
 * Data sources:
 *   - GET /reporting/cash-accounts
 *   - GET /reporting/banks
 *   - GET /reporting/bank-accounts
 */
import { useQuery } from '@tanstack/react-query'
import { reportingApi } from '../../reporting/api'
import {
  BooleanBadge,
  Card,
  EmptyState,
  ErrorState,
  KpiCard,
  PageHeader,
  Skeleton,
  Table,
  Th,
  Td,
} from '../../../components/ui'

export function CashBankPage() {
  const cashQ = useQuery({ queryKey: ['cash-accounts'], queryFn: reportingApi.listCashAccounts })
  const banksQ = useQuery({ queryKey: ['banks'], queryFn: reportingApi.listBanks })
  const bankAccountsQ = useQuery({ queryKey: ['bank-accounts'], queryFn: reportingApi.listBankAccounts })

  const isLoading = cashQ.isLoading || banksQ.isLoading || bankAccountsQ.isLoading
  const error = cashQ.error || banksQ.error || bankAccountsQ.error

  const cashAccounts = cashQ.data ?? []
  const banks = banksQ.data ?? []
  const bankAccounts = bankAccountsQ.data ?? []

  return (
    <div>
      <PageHeader title="النقد والبنوك" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <KpiCard label="حسابات النقد" value={String(cashAccounts.length)} tone="default" />
        <KpiCard label="البنوك المسجلة" value={String(banks.length)} tone="warning" />
        <KpiCard label="الحسابات البنكية" value={String(bankAccounts.length)} tone="success" />
      </div>

      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {/* ---------- Cash Accounts ---------- */}
      <Card className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 px-4 pt-4">حسابات النقد</h2>
        <div className="p-2">
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : cashAccounts.length === 0 ? (
            <EmptyState message="لا توجد حسابات نقدية بعد. يتم إنشاؤها عبر قيود المحاسبة أو إعداد النظام." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>اسم الحساب</Th>
                  <Th>الحساب العام</Th>
                  <Th>العملة</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cashAccounts.map((c) => (
                  <tr key={c.uuid} className="hover:bg-gray-50">
                    <Td className="font-medium text-gray-800">{c.account_name}</Td>
                    <Td className="text-gray-700">
                      {c.gl_account_code ? `${c.gl_account_code} — ${c.gl_account_name ?? ''}` : '—'}
                    </Td>
                    <Td className="text-gray-700">{c.currency_code ?? '—'}</Td>
                    <Td><BooleanBadge value={c.is_active} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {/* ---------- Bank Accounts ---------- */}
      <Card className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 px-4 pt-4">الحسابات البنكية</h2>
        <div className="p-2">
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : bankAccounts.length === 0 ? (
            <EmptyState message="لا توجد حسابات بنكية بعد." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>البنك</Th>
                  <Th>رقم الحساب (مقنّع)</Th>
                  <Th>الحساب العام</Th>
                  <Th>العملة</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bankAccounts.map((b) => (
                  <tr key={b.uuid} className="hover:bg-gray-50">
                    <Td className="font-medium text-gray-800">{b.bank_name ?? '—'}</Td>
                    <Td className="font-mono text-xs text-gray-700">{b.account_number_masked}</Td>
                    <Td className="text-gray-700">
                      {b.gl_account_code ? `${b.gl_account_code} — ${b.gl_account_name ?? ''}` : '—'}
                    </Td>
                    <Td className="text-gray-700">{b.currency_code ?? '—'}</Td>
                    <Td><BooleanBadge value={b.is_active} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {/* ---------- Banks (global reference) ---------- */}
      <Card>
        <h2 className="text-lg font-bold text-gray-800 px-4 pt-4">البنوك (بيانات مرجعية)</h2>
        <div className="p-2">
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : banks.length === 0 ? (
            <EmptyState message="لا توجد بنوك مسجلة في النظام." />
          ) : (
            <Table>
              <thead>
                <tr><Th>اسم البنك</Th><Th>الحالة</Th></tr>
              </thead>
              <tbody className="divide-y">
                {banks.map((b) => (
                  <tr key={b.uuid} className="hover:bg-gray-50">
                    <Td className="font-medium text-gray-800">{b.bank_name}</Td>
                    <Td><BooleanBadge value={b.is_active} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <p className="mt-4 text-xs text-gray-500">
        ملاحظة: لا توجد واجهة لإنشاء/تعديل حسابات النقد أو البنوك بعد — يتم تسجيلها عبر إعداد النظام أو قيود المحاسبة المباشرة.
      </p>
    </div>
  )
}
