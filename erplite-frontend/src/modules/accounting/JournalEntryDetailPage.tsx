/**
 * src/modules/accounting/JournalEntryDetailPage.tsx
 *
 * Read-only view of a single journal entry. Resolves account UUIDs → names
 * using the accounts list (already cached by the form page).
 *
 * Features:
 *   - ConfirmDialog before submit
 *   - Account name resolution (UUID → "code — name")
 *   - Total debit / credit display
 *   - Responsive table (overflow-x-auto)
 *   - 409 (stale version) auto-refetch
 *   - Print button (window.print)
 *
 * BR-ACC-001 (no edit after submit) is enforced at the API level by
 * omission — the backend exposes no PUT/PATCH endpoint for JournalEntry at
 * all. We reflect this in the UI by hiding the edit affordance entirely.
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { accountingApi, type Account } from './api'
import { StatusBadge } from '../../components/StatusBadge'
import { ApiError, describeError } from '../../api/client'
import {
  Card,
  DetailField,
  ErrorState,
  PageHeader,
  Spinner,
  Table,
  Th,
  Td,
  ConfirmDialog,
  useToast,
} from '../../components/ui'

export function JournalEntryDetailPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: entry, isLoading } = useQuery({
    queryKey: ['journal-entry', uuid],
    queryFn: () => accountingApi.getJournalEntry(uuid!),
    enabled: !!uuid,
  })

  // Fetch accounts in parallel so we can resolve account UUIDs → names.
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountingApi.listAccounts,
  })

  const accountMap = new Map<string, Account>(
    (accounts ?? []).map((a) => [a.uuid, a]),
  )

  const submitMutation = useMutation({
    mutationFn: () => accountingApi.submitJournalEntry(uuid!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entry', uuid] })
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      setConfirmOpen(false)
      toast.success('تم ترحيل القيد')
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setError('تم تعديل القيد من مستخدم آخر — جاري إعادة التحميل')
        queryClient.invalidateQueries({ queryKey: ['journal-entry', uuid] })
      } else {
        setError(describeError(err))
      }
      setConfirmOpen(false)
    },
  })

  if (isLoading) return <Spinner />
  if (!entry) return <ErrorState message="القيد غير موجود" />

  const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit_amount), 0)
  const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit_amount), 0)

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`قيد ${entry.document_number}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              طباعة
            </button>
            <StatusBadge status={entry.status} />
          </div>
        }
      />

      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      <Card className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          <DetailField label="رقم المستند" value={entry.document_number} ltr />
          <DetailField label="تاريخ الترحيل" value={entry.posting_date} ltr />
          <DetailField
            label="الحالة"
            value={<StatusBadge status={entry.status} />}
          />
          <DetailField label="البيان" value={entry.narration} />
        </div>

        <Table>
          <thead>
            <tr>
              <Th>الحساب</Th>
              <Th>مدين</Th>
              <Th>دائن</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entry.lines.map((l, i) => {
              const acc = accountMap.get(l.account_uuid)
              return (
                <tr key={i}>
                  <Td>
                    {acc ? (
                      <Link
                        to={`/accounting/accounts?focus=${acc.uuid}`}
                        className="text-blue-600 hover:underline"
                      >
                        <span className="font-mono text-xs text-gray-500">
                          {acc.account_code}
                        </span>{' '}
                        — {acc.account_name}
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400 font-mono ltr-text">
                        {l.account_uuid}
                      </span>
                    )}
                  </Td>
                  <Td>{Number(l.debit_amount) > 0 ? l.debit_amount : '—'}</Td>
                  <Td>{Number(l.credit_amount) > 0 ? l.credit_amount : '—'}</Td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <Td className="font-bold">الإجمالي</Td>
              <Td className="font-bold">{totalDebit.toFixed(2)}</Td>
              <Td className="font-bold">{totalCredit.toFixed(2)}</Td>
            </tr>
          </tfoot>
        </Table>

        {entry.status === 'draft' && (
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={submitMutation.isPending}
            className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitMutation.isPending ? 'جاري الترحيل...' : 'ترحيل القيد'}
          </button>
        )}
        {entry.status !== 'draft' && (
          <p className="text-xs text-gray-400">
            قيد مُرحَّل — لا يمكن تعديله (BR-ACC-001)
          </p>
        )}
      </Card>

      <div className="mt-4">
        <Link to="/accounting/journal-entries" className="text-sm text-blue-600 hover:underline">
          ← العودة لقائمة القيود
        </Link>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="تأكيد ترحيل القيد"
        description={
          <>
            سيتم ترحيل القيد <strong>{entry.document_number}</strong>. بعد الترحيل
            لا يمكن تعديل القيد نهائياً وفق قاعدة BR-ACC-001.
          </>
        }
        confirmLabel="ترحيل"
        busy={submitMutation.isPending}
        onConfirm={() => submitMutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
