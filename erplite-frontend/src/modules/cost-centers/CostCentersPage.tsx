/**
 * src/modules/cost-centers/CostCentersPage.tsx
 *
 * Full CRUD page for cost centers (v1.0):
 *   - List with search + status filter + sortable columns
 *   - Create new cost center (modal)
 *   - Edit existing cost center (modal) — name + is_active
 *   - Parent cost center picker (select from existing)
 *
 * Backend endpoints used:
 *   GET    /cost-centers
 *   POST   /cost-centers
 *   PATCH  /cost-centers/{uuid}
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { costCentersApi } from './api'
import type { CostCenter, CostCenterCreateInput, CostCenterUpdateInput } from './types'
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
  useToast,
} from '../../components/ui'

type StatusFilter = 'all' | 'active' | 'suspended'

export function CostCentersPage() {
  const toast = useToast()
  const qc = useQueryClient()

  const [search, setSearch] = useUrlState('q', '')
  const [statusStr, setStatusStr] = useUrlState('status', 'all')
  const status = statusStr as StatusFilter
  const setStatus = (v: StatusFilter) => setStatusStr(v)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editing, setEditing] = useState<CostCenter | null>(null)

  const { data: costCenters, isLoading, error } = useQuery({
    queryKey: ['cost-centers'],
    queryFn: costCentersApi.list,
  })

  const filtered = useMemo(() => {
    if (!costCenters) return []
    const q = search.trim().toLowerCase()
    return costCenters.filter((c) => {
      const matchesSearch =
        !q ||
        c.cost_center_code.toLowerCase().includes(q) ||
        c.cost_center_name.toLowerCase().includes(q)
      const matchesStatus =
        status === 'all' ||
        (status === 'active' && c.is_active) ||
        (status === 'suspended' && !c.is_active)
      return matchesSearch && matchesStatus
    })
  }, [costCenters, search, status])

  const { sortKey, sortDir, toggleSort, sortData } = useSort<CostCenter>('cost_center_code', 'asc')
  const sorted = sortData(filtered, (c) => String(c[sortKey as keyof CostCenter] ?? ''))

  const activeCount = costCenters?.filter((c) => c.is_active).length ?? 0
  const suspendedCount = (costCenters?.length ?? 0) - activeCount

  const createMutation = useMutation({
    mutationFn: costCentersApi.create,
    onSuccess: () => {
      toast.success('تم إنشاء مركز التكلفة')
      qc.invalidateQueries({ queryKey: ['cost-centers'] })
      setShowCreateModal(false)
    },
    onError: (e: unknown) => {
      toast.error(describeError(e))
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { uuid: string; body: CostCenterUpdateInput }) =>
      costCentersApi.update(data.uuid, data.body),
    onSuccess: () => {
      toast.success('تم تحديث مركز التكلفة')
      qc.invalidateQueries({ queryKey: ['cost-centers'] })
      setEditing(null)
    },
    onError: (e: unknown) => {
      toast.error(describeError(e))
    },
  })

  const hasActiveFilters = !!search || status !== 'all'

  return (
    <div>
      <PageHeader
        title="مراكز التكلفة"
        actions={
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            + مركز تكلفة جديد
          </button>
        }
      />

      <p className="text-sm text-gray-600 mb-4">
        مراكز التكلفة تُستخدم لتجميع المصروفات والإيرادات حسب القسم/الفرع. هذه
        شاشة بيانات أساسية — ربطها بالمعاملات (قيود اليومية، الفواتير) مؤجَّل
        للإصدار القادم.
      </p>

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
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="all">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="suspended">موقوف</option>
          </select>
        }
        onClear={() => {
          setSearch('')
          setStatus('all')
        }}
        hasActiveFilters={hasActiveFilters}
      />

      {isLoading && <Skeleton className="h-32 w-full" />}
      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {costCenters && (
        <>
          <CountSummary
            shown={filtered.length}
            total={costCenters.length}
            breakdown={[
              { label: 'نشط', count: activeCount, tone: 'green' },
              { label: 'موقوف', count: suspendedCount, tone: 'rose' },
            ]}
          />
          {sorted.length === 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>الكود</Th>
                  <Th>الاسم</Th>
                  <Th>الأب</Th>
                  <Th>الحالة</Th>
                  <Th>إجراءات</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5}>
                    <EmptyState message={hasActiveFilters ? 'لا يوجد مراكز تكلفة مطابقون للبحث' : 'لا يوجد مراكز تكلفة بعد'} />
                  </td>
                </tr>
              </tbody>
            </Table>
          ) : (
            <Table>
              <thead>
                <tr>
                  <SortableTh label="الكود" sortKey="cost_center_code" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="الاسم" sortKey="cost_center_name" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th>الأب</Th>
                  <Th>الحالة</Th>
                  <Th>إجراءات</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((c) => {
                  const parent = costCenters.find((p) => p.uuid === c.parent_cost_center_uuid)
                  return (
                    <tr key={c.uuid} className="hover:bg-gray-50">
                      <Td className="font-mono text-xs">{c.cost_center_code}</Td>
                      <Td className="font-medium text-gray-800">{c.cost_center_name}</Td>
                      <Td className="text-gray-600">{parent ? parent.cost_center_name : '—'}</Td>
                      <Td><BooleanBadge value={c.is_active} /></Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() => setEditing(c)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          تعديل
                        </button>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </>
      )}

      {showCreateModal && (
        <CostCenterFormModal
          existing={null}
          allCostCenters={costCenters ?? []}
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutate(data as CostCenterCreateInput)}
          isSubmitting={createMutation.isPending}
        />
      )}

      {editing && (
        <CostCenterFormModal
          existing={editing}
          allCostCenters={costCenters ?? []}
          onClose={() => setEditing(null)}
          // The modal's handleSubmit already includes expected_version_no in
          // the CostCenterUpdateInput, so we just pass `data` through as-is.
          onSubmit={(data) =>
            updateMutation.mutate({
              uuid: editing.uuid,
              body: data as CostCenterUpdateInput,
            })
          }
          isSubmitting={updateMutation.isPending}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal form (create + edit share this component)
// ---------------------------------------------------------------------------
interface FormModalProps {
  existing: CostCenter | null
  allCostCenters: CostCenter[]
  onClose: () => void
  onSubmit: (data: CostCenterCreateInput | CostCenterUpdateInput) => void
  isSubmitting: boolean
}

function CostCenterFormModal({ existing, allCostCenters, onClose, onSubmit, isSubmitting }: FormModalProps) {
  const isEdit = existing !== null
  const [code, setCode] = useState(existing?.cost_center_code ?? '')
  const [name, setName] = useState(existing?.cost_center_name ?? '')
  const [parentUuid, setParentUuid] = useState<string>(existing?.parent_cost_center_uuid ?? '')
  const [isActive, setIsActive] = useState(existing?.is_active ?? true)

  // For parent picker, exclude self + descendants (simplified: just exclude self)
  const parentOptions = allCostCenters.filter((c) => c.uuid !== existing?.uuid)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEdit && existing) {
      onSubmit({
        cost_center_name: name,
        is_active: isActive,
        expected_version_no: existing.version_no,
      } as CostCenterUpdateInput)
    } else {
      onSubmit({
        cost_center_code: code,
        cost_center_name: name,
        parent_cost_center_uuid: parentUuid || null,
      } as CostCenterCreateInput)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full bg-white">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'تعديل مركز تكلفة' : 'مركز تكلفة جديد'}
          </h2>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الكود *</label>
              <input
                required
                maxLength={50}
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="مثلاً: CC-001"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الاسم *</label>
            <input
              required
              maxLength={200}
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: قسم المبيعات"
            />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">مركز التكلفة الأب</label>
              <select
                className="input"
                value={parentUuid}
                onChange={(e) => setParentUuid(e.target.value)}
              >
                <option value="">— بدون (مستوى أعلى) —</option>
                {parentOptions.map((p) => (
                  <option key={p.uuid} value={p.uuid}>
                    {p.cost_center_code} — {p.cost_center_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isEdit && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                نشط
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
