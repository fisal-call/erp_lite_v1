/** src/modules/accounting/JournalEntryFormPage.tsx
 *
 * Form for creating a new journal entry.
 *
 * Uses:
 *   - Card + PageHeader + Toast for consistent UX
 *   - AccountAutocomplete for picking accounts (searchable, not a raw <select>)
 *   - Live debit/credit balance check (BR-ACC-003) — server is final judge
 *   - BR-ACC-002: groups are filtered out of the account picker
 *
 * The submit button is disabled until totalDebit === totalCredit AND
 * totalDebit > 0 (BR-ACC-003: a balanced entry needs at least 2 lines).
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { accountingApi, type Account } from './api'
import { describeError } from '../../api/client'
import { AccountAutocomplete } from '../../components/AccountAutocomplete'
import { Card, PageHeader, useToast } from '../../components/ui'

interface LineDraft {
  account?: Account
  debit: number
  credit: number
}

export function JournalEntryFormPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [postingDate, setPostingDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [narration, setNarration] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { debit: 0, credit: 0 },
    { debit: 0, credit: 0 },
  ])
  const [apiError, setApiError] = useState<string | null>(null)

  // Note: AccountAutocomplete fetches its own account list internally; we do
  // NOT need to preload here (previous useEffect was a no-op duplicate fetch).

  const mutation = useMutation({
    mutationFn: accountingApi.createJournalEntry,
    onSuccess: (entry) => {
      toast.success(`تم حفظ القيد: ${entry.document_number}`)
      navigate(`/accounting/journal-entries/${entry.uuid}`)
    },
    onError: (err) => {
      const msg = describeError(err)
      setApiError(msg)
      toast.error(msg)
    },
  })

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  const balanced = totalDebit === totalCredit && totalDebit > 0

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  function handleSubmit() {
    setApiError(null)
    if (!balanced) return setApiError('القيد غير متوازن — مجموع المدين يجب أن يساوي مجموع الدائن')
    if (lines.some((l) => !l.account)) return setApiError('كل سطر لازم يكون له حساب مُختار')
    if (lines.some((l) => l.debit > 0 && l.credit > 0)) {
      return setApiError('كل سطر يجب أن يكون إما مدين أو دائن — ليس الاثنين معاً')
    }
    if (lines.some((l) => l.debit === 0 && l.credit === 0)) {
      return setApiError('كل سطر يجب أن يكون له قيمة (مدين أو دائن)')
    }

    mutation.mutate({
      posting_date: postingDate,
      narration: narration || undefined,
      lines: lines.map((l) => ({
        account_uuid: l.account!.uuid,
        debit_amount: l.debit,
        credit_amount: l.credit,
      })),
    })
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="قيد يومية جديد" />

      {apiError && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md border border-red-200 mb-4">
          {apiError}
        </div>
      )}

      <Card>
        {/* Header: date + narration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm mb-1 text-gray-700">
              التاريخ
              <span className="text-rose-600 mr-1">*</span>
            </label>
            <input
              type="date"
              className="input"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-700">البيان</label>
            <input
              className="input"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="وصف مختصر للقيد (اختياري)"
            />
          </div>
        </div>

        {/* Lines */}
        <div>
          <label className="block text-sm mb-2 text-gray-700 font-medium">
            السطور
            <span className="text-rose-600 mr-1">*</span>
          </label>
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div
                key={i}
                className="flex flex-col md:flex-row md:items-center gap-2 border border-gray-100 rounded-md p-2"
              >
                <div className="flex-1 min-w-0">
                  <AccountAutocomplete
                    selectedUuid={line.account?.uuid}
                    onSelect={(acc) => updateLine(i, { account: acc })}
                  />
                  {line.account && (
                    <p className="text-xs text-emerald-700 mt-1">
                      ✓ {line.account.account_code} — {line.account.account_name}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="input w-28"
                    placeholder="مدين"
                    min="0"
                    step="0.01"
                    value={line.debit || ''}
                    onChange={(e) =>
                      updateLine(i, { debit: Number(e.target.value), credit: 0 })
                    }
                  />
                  <input
                    type="number"
                    className="input w-28"
                    placeholder="دائن"
                    min="0"
                    step="0.01"
                    value={line.credit || ''}
                    onChange={(e) =>
                      updateLine(i, { credit: Number(e.target.value), debit: 0 })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 2}
                    className="text-red-500 px-2 py-2 hover:bg-red-50 rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label="حذف السطر"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, { debit: 0, credit: 0 }])}
            className="text-blue-600 text-sm mt-3 hover:underline"
          >
            + إضافة سطر
          </button>
        </div>

        {/* Balance summary */}
        <div
          className={`flex justify-between items-center border-t pt-3 mt-4 text-sm font-medium rounded-md p-3 ${
            balanced
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>مجموع المدين: {totalDebit.toFixed(2)}</span>
          <span>مجموع الدائن: {totalCredit.toFixed(2)}</span>
          <span>{balanced ? '✓ متوازن' : '✗ غير متوازن'}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <button
            onClick={handleSubmit}
            disabled={!balanced || mutation.isPending}
            className="flex-1 bg-blue-600 text-white rounded-md py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'جاري الحفظ...' : 'حفظ القيد'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/accounting/journal-entries')}
            className="px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50"
          >
            إلغاء
          </button>
        </div>
      </Card>
    </div>
  )
}
