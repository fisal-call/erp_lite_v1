/**
 * src/modules/settings/reference/CountriesPage.tsx
 *
 * Read-only list of countries exposed by GET /core/countries.
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
  SortableTh,
  Table,
  Th,
  Td,
  useSort,
  useUrlState,
} from '../../../components/ui'
import type { Country } from '../../core-org/api'

export function CountriesPage() {
  const [search, setSearch] = useUrlState('q', '')
  const { data: countries, isLoading, error } = useQuery({
    queryKey: ['countries'],
    queryFn: coreOrgApi.listCountries,
    staleTime: 10 * 60 * 1000, // countries don't change — cache 10 min
  })

  const filtered = countries?.filter(
    (c) =>
      c.name_ar.includes(search) ||
      c.name_en.toLowerCase().includes(search.toLowerCase()) ||
      c.iso_code.toLowerCase().includes(search.toLowerCase()),
  )

  const { sortKey, sortDir, toggleSort, sortData } = useSort<Country>('iso_code', 'asc')
  const sorted = sortData(filtered ?? [], (c) => c[sortKey as keyof Country] ?? '')

  return (
    <div>
      <PageHeader title="الدول" />

      <FilterBar
        search={
          <input
            placeholder="بحث بالاسم أو الكود..."
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
              <Th>ISO Code</Th>
              <Th>الاسم (عربي)</Th>
              <Th>الاسم (إنجليزي)</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td><Skeleton className="h-4 w-12" /></Td>
                <Td><Skeleton className="h-4 w-32" /></Td>
                <Td><Skeleton className="h-4 w-32" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      {countries && (
        <>
          <CountSummary shown={filtered?.length ?? 0} total={countries.length} />
          {sorted.length === 0 ? (
            <Card><EmptyState message="لا توجد دول مطابقة" /></Card>
          ) : (
            <Table>
              <thead>
                <tr>
                  <SortableTh label="ISO Code" sortKey="iso_code" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="الاسم (عربي)" sortKey="name_ar" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="الاسم (إنجليزي)" sortKey="name_en" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((c) => (
                  <tr key={c.uuid} className="hover:bg-gray-50">
                    <Td className="font-mono text-xs">{c.iso_code}</Td>
                    <Td className="font-medium text-gray-800">{c.name_ar}</Td>
                    <Td className="text-gray-600 ltr-text text-left">{c.name_en}</Td>
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
