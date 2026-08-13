/**
 * src/modules/accounting/trial-balance/TrialBalancePage.tsx
 *
 * Trial Balance page — wired to the backend's GET /api/v1/accounting/trial-balance.
 *
 * The endpoint reads from `reporting.v_trial_balance` (Phase 2 SQL view) which
 * aggregates accounting.general_ledger_entry. The GL is populated when a
 * JournalEntry is submitted (see app/modules/accounting/service.py::submit).
 *
 * Rows are read-only (no edit/delete). Includes:
 *   - Search filter (by account code or name)
 *   - Type filter
 *   - Total debit / credit / net balance footer
 *   - Print-friendly layout
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { accountingApi } from '../api'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, FilterBar, CountSummary } from '../../../components/ui'
import { useUrlState } from '../../../components/ui/useUrlState'

const TYPE_LABELS: Record<string, string> = {
  asset: 'أصول',
  liability: 'خصوم',
  equity: 'حقوق ملكية',
  revenue: 'إيرادات',
  expense: 'مصروفات',
}

export function TrialBalancePage() {
  const [search, setSearch] = useUrlState('q', '')
  const [typeFilter, setTypeFilter] = useUrlState('type', '')

  const { data, isLoading, error } = useQuery({
    queryKey: ['trial-balance'],
    queryFn: accountingApi.listTrialBalance,
    staleTime: 60_000,
  })

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.filter((r) => {
      if (typeFilter && r.account_type !== typeFilter) return false
      if (!q) return true
      return (
        r.account_code.toLowerCase().includes(q) ||
        r.account_name.toLowerCase().includes(q)
      )
    })
  }, [data, search, typeFilter])

  // Totals across all filtered rows
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.debit += Number(r.total_debit) || 0
        acc.credit += Number(r.total_credit) || 0
        acc.net += Number(r.net_balance) || 0
        return acc
      },
      { debit: 0, credit: 0, net: 0 },
    )
  }, [filtered])

  const fmt = (n: number) =>
    n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div>
      <PageHeader title="ميزان المراجعة" />

      <FilterBar
        search={
          <input
            className="input w-full sm:w-64"
            placeholder="بحث برقم الحساب أو الاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
        filters={
          <select
            className="input w-auto"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">كل الأنواع</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        }
        onClear={() => { setSearch(''); setTypeFilter('') }}
        hasActiveFilters={!!search || !!typeFilter}
      />

      <CountSummary
        shown={filtered.length}
        total={data?.length ?? 0}
      />

      <div className="text-xs text-gray-500 mb-3">
        إجمالي مدين: <strong className="ltr-text">{fmt(totals.debit)}</strong>
        {' · '}
        إجمالي دائن: <strong className="ltr-text">{fmt(totals.credit)}</strong>
        {totals.debit === totals.credit && totals.debit > 0 && (
          <span className="ml-2 text-emerald-700">✓ متوازن</span>
        )}
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <Card padded={false}>
          <div className="p-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            data && data.length === 0
              ? 'لا توجد قيود مرحَّلة بعد. أنشئ قيد يومية واعتمده ليظهر هنا.'
              : 'لا توجد نتائج مطابقة'
          }
        />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b">
                <tr>
                  <th className="p-3 text-right font-medium w-32">رقم الحساب</th>
                  <th className="p-3 text-right font-medium">اسم الحساب</th>
                  <th className="p-3 text-right font-medium w-32">النوع</th>
                  <th className="p-3 text-right font-medium w-32">مدين</th>
                  <th className="p-3 text-right font-medium w-32">دائن</th>
                  <th className="p-3 text-right font-medium w-32">الرصيد الصافي</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r, i) => (
                  <tr key={`${r.account_code}-${i}`} className="hover:bg-gray-50">
                    <td className="p-3 font-mono text-xs ltr-text">{r.account_code}</td>
                    <td className="p-3 text-gray-800">{r.account_name}</td>
                    <td className="p-3">
                      <span className="inline-block px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
                        {TYPE_LABELS[r.account_type] ?? r.account_type}
                      </span>
                    </td>
                    <td className="p-3 ltr-text text-right tabular-nums">
                      {r.total_debit > 0 ? fmt(r.total_debit) : '—'}
                    </td>
                    <td className="p-3 ltr-text text-right tabular-nums">
                      {r.total_credit > 0 ? fmt(r.total_credit) : '—'}
                    </td>
                    <td className={`p-3 ltr-text text-right tabular-nums font-medium ${
                      r.net_balance > 0 ? 'text-emerald-700' : r.net_balance < 0 ? 'text-rose-700' : 'text-gray-500'
                    }`}>
                      {fmt(Math.abs(r.net_balance))} {r.net_balance > 0 ? 'مدين' : r.net_balance < 0 ? 'دائن' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr className="font-bold">
                  <td colSpan={3} className="p-3 text-right">الإجمالي</td>
                  <td className="p-3 ltr-text text-right tabular-nums">{fmt(totals.debit)}</td>
                  <td className="p-3 ltr-text text-right tabular-nums">{fmt(totals.credit)}</td>
                  <td className="p-3 ltr-text text-right tabular-nums">
                    {totals.debit === totals.credit ? (
                      <span className="text-emerald-700">متوازن ✓</span>
                    ) : (
                      <span className="text-rose-700">غير متوازن ✗</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs text-gray-400 mt-4 leading-relaxed">
        ميزان المراجعة يُحسب من قيود اليومية المرحَّلة فقط. القيود المسودة لا تظهر هنا.
        البيانات مصدرها <code className="bg-gray-100 px-1 rounded">reporting.v_trial_balance</code>
        في قاعدة البيانات.
      </p>
    </div>
  )
}
