/**
 * src/modules/accounting/AccountsPage.tsx
 *
 * Chart of Accounts list + inline create form. Backend fully supports
 * parent_account_uuid on AccountCreate (resolved to parent_account_id in
 * AccountService.create). The create form exposes a parent picker.
 *
 * The list renders flat (not a tree) because AccountRead does not expose
 * parent_account_uuid in the response — a tree view is a future enhancement
 * that requires a backend schema change to expose the parent reference.
 *
 * Adds:
 *   - Search by code/name + type filter
 *   - Count summary with type breakdown
 *   - Color-coded type badges
 *   - BooleanBadge for is_active state
 *   - Parent account picker (optional) on create form
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { accountingApi } from './api'
import { describeError } from '../../api/client'
import {
  BooleanBadge,
  Card,
  CountSummary,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Skeleton,
  SortableTh,
  Table,
  Th,
  Td,
  useSort,
  useUrlState,
} from '../../components/ui'
import type { Account } from './api'

const TYPE_LABELS: Record<string, string> = {
  asset: 'أصول',
  liability: 'خصوم',
  equity: 'حقوق ملكية',
  revenue: 'إيرادات',
  expense: 'مصروفات',
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  asset: 'bg-blue-100 text-blue-700',
  liability: 'bg-amber-100 text-amber-700',
  equity: 'bg-purple-100 text-purple-700',
  revenue: 'bg-emerald-100 text-emerald-700',
  expense: 'bg-rose-100 text-rose-700',
}

export function AccountsPage() {
  const queryClient = useQueryClient()
  // Honor ?focus=<uuid> so the link from JournalEntryDetailPage can deep-link
  // to a specific account row. The row gets a temporary yellow highlight that
  // fades after a few seconds so the user can find it in a long list.
  const [searchParams] = useSearchParams()
  const focusUuid = searchParams.get('focus')
  const { data: accounts, isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountingApi.listAccounts,
  })

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('asset')
  const [isGroup, setIsGroup] = useState(false)
  const [parentAccountUuid, setParentAccountUuid] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useUrlState('q', '')
  const [typeFilter, setTypeFilter] = useUrlState('type', 'all')

  const filtered = useMemo(() => {
    if (!accounts) return []
    const q = search.trim().toLowerCase()
    return accounts.filter((a) => {
      const matchesSearch =
        !q ||
        a.account_name.toLowerCase().includes(q) ||
        a.account_code.toLowerCase().includes(q)
      const matchesType = typeFilter === 'all' || a.account_type === typeFilter
      return matchesSearch && matchesType
    })
  }, [accounts, search, typeFilter])

  const hasActiveFilters = !!search || typeFilter !== 'all'

  const { sortKey, sortDir, toggleSort, sortData } = useSort<Account>('account_code', 'asc')
  const sorted = sortData(filtered, (a) => a[sortKey as keyof Account] ?? '')

  const mutation = useMutation({
    mutationFn: accountingApi.createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setCode('')
      setName('')
      setType('asset')
      setIsGroup(false)
      setParentAccountUuid('')
      setFormError(null)
    },
    onError: (err) => setFormError(describeError(err)),
  })

  // Type breakdown for the count summary
  const typeBreakdown = useMemo(() => {
    if (!accounts) return []
    return Object.keys(TYPE_LABELS).map((t) => ({
      label: TYPE_LABELS[t],
      count: accounts.filter((a) => a.account_type === t).length,
    }))
  }, [accounts])

  return (
    <div>
      <PageHeader title="شجرة الحسابات" />

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Table>
              <thead>
                <tr>
                  <Th>الكود</Th>
                  <Th>الاسم</Th>
                  <Th>النوع</Th>
                  <Th>المجموعة</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <Td><Skeleton className="h-4 w-16" /></Td>
                    <Td><Skeleton className="h-4 w-40" /></Td>
                    <Td><Skeleton className="h-5 w-16 rounded-full" /></Td>
                    <Td><Skeleton className="h-5 w-14 rounded-full" /></Td>
                    <Td><Skeleton className="h-5 w-14 rounded-full" /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <Card><Skeleton className="h-64 w-full" /></Card>
        </div>
      )}
      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* List column */}
        <div className="lg:col-span-2">
          <FilterBar
            search={
              <input
                placeholder="بحث بالكود أو الاسم..."
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            }
            filters={
              <select
                className="input max-w-[140px]"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">كل الأنواع</option>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            }
            onClear={() => {
              setSearch('')
              setTypeFilter('all')
            }}
            hasActiveFilters={hasActiveFilters}
          />

          {accounts && (
            <CountSummary
              shown={filtered.length}
              total={accounts.length}
              breakdown={typeBreakdown.slice(0, 3).map((b) => ({
                label: b.label,
                count: b.count,
                tone: 'gray',
              }))}
            />
          )}

          {accounts && accounts.length === 0 ? (
            <Card><EmptyState message="لا يوجد حسابات بعد — أضف أول حساب من النموذج" /></Card>
          ) : sorted.length === 0 ? (
            <Card><EmptyState message="لا توجد حسابات مطابقة" /></Card>
          ) : (
            <Table>
              <thead>
                <tr>
                  <SortableTh label="الكود" sortKey="account_code" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="الاسم" sortKey="account_name" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="النوع" sortKey="account_type" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th>المجموعة</Th>
                  <SortableTh label="الحالة" sortKey="is_active" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((a) => (
                  <tr
                    key={a.uuid}
                    className={
                      focusUuid && a.uuid === focusUuid
                        ? 'bg-yellow-50 ring-1 ring-yellow-200'
                        : 'hover:bg-gray-50'
                    }
                  >
                    <Td className="font-mono text-xs">{a.account_code}</Td>
                    <Td className={a.is_group ? 'font-bold text-gray-800' : 'text-gray-800'}>
                      {a.account_name}
                    </Td>
                    <Td>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          TYPE_BADGE_COLORS[a.account_type] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {TYPE_LABELS[a.account_type] ?? a.account_type}
                      </span>
                    </Td>
                    <Td>
                      <BooleanBadge
                        value={a.is_group}
                        trueLabel="رئيسي"
                        falseLabel="فرعي"
                      />
                    </Td>
                    <Td><BooleanBadge value={a.is_active} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        {/* Create form */}
        <Card>
          <h2 className="font-bold mb-3 text-gray-800">حساب جديد</h2>
          {formError && <div className="mb-3"><ErrorState message={formError} /></div>}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!code.trim() || !name.trim()) {
                setFormError('الكود والاسم مطلوبان')
                return
              }
              mutation.mutate({
                account_code: code,
                account_name: name,
                account_type: type,
                is_group: isGroup,
                parent_account_uuid: parentAccountUuid || undefined,
              })
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-sm mb-1 text-gray-700">
                الكود<span className="text-rose-600 mr-1">*</span>
              </label>
              <input
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={30}
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-700">
                الاسم<span className="text-rose-600 mr-1">*</span>
              </label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-700">النوع</label>
              <select
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isGroup}
                onChange={(e) => setIsGroup(e.target.checked)}
              />
              حساب رئيسي (Group) — لا يقبل القيود
            </label>
            <div>
              <label className="block text-sm mb-1 text-gray-700">الحساب الأب (اختياري)</label>
              <select
                className="input"
                value={parentAccountUuid}
                onChange={(e) => setParentAccountUuid(e.target.value)}
                disabled={!accounts || accounts.length === 0}
              >
                <option value="">— بدون —</option>
                {(accounts ?? [])
                  // Only group accounts can be parents.
                  .filter((a) => a.is_group && a.is_active)
                  .map((a) => (
                    <option key={a.uuid} value={a.uuid}>
                      {a.account_code} — {a.account_name}
                    </option>
                  ))}
              </select>
              {accounts && accounts.filter((a) => a.is_group).length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  لا توجد حسابات رئيسية بعد — يمكن اختيار أب بعد إنشاء حساب رئيسي.
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-blue-600 text-white rounded-md py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'جاري الحفظ...' : 'إضافة الحساب'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  )
}
