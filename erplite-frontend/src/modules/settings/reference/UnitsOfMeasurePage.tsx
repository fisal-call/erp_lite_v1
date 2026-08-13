/**
 * src/modules/settings/reference/UnitsOfMeasurePage.tsx
 *
 * Read-only list of units of measure exposed by GET /core/units-of-measure.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { coreOrgApi } from '../../core-org/api'
import {
  Card,
  CountSummary,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Skeleton,
  Table,
  Th,
  Td,
  useUrlState,
} from '../../../components/ui'

export function UnitsOfMeasurePage() {
  const [search, setSearch] = useUrlState('q', '')
  const { data: uoms, isLoading, error } = useQuery({
    queryKey: ['units-of-measure'],
    queryFn: coreOrgApi.listUnitsOfMeasure,
    staleTime: 10 * 60 * 1000,
  })

  const filtered = uoms?.filter((u) => u.uom_name.includes(search))

  return (
    <div>
      <PageHeader title="وحدات القياس" />

      <FilterBar
        search={
          <input
            placeholder="بحث بالاسم..."
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
        onClear={() => setSearch('')}
        hasActiveFilters={!!search}
      />

      {isLoading && (
        <Table>
          <thead>
            <tr>
              <Th>الاسم</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td><Skeleton className="h-4 w-32" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {uoms && (
        <>
          <CountSummary shown={filtered?.length ?? 0} total={uoms.length} />
          {filtered && filtered.length === 0 ? (
            <Card><EmptyState message="لا توجد وحدات قياس مطابقة" /></Card>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>الاسم</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered?.map((u) => (
                  <tr key={u.uuid} className="hover:bg-gray-50">
                    <Td className="font-medium text-gray-800">{u.uom_name}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}

      <div className="mt-4">
        <Link to="/settings/reference" className="text-sm text-blue-600 hover:underline">
          ← العودة لصفحة البيانات المرجعية
        </Link>
      </div>
    </div>
  )
}
