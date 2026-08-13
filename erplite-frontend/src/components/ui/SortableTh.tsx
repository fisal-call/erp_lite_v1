/**
 * src/components/ui/SortableTh.tsx
 *
 * Table header cell with sort indicator. Clicking toggles asc → desc → asc.
 * Visually shows ▲ / ▼ next to the active column. Inactive columns get a
 * faded ▲▼ to hint that they are sortable.
 *
 * Usage:
 *   <SortableTh
 *     label="الاسم"
 *     sortKey="customer_name"
 *     currentSortKey={sortKey}
 *     sortDir={sortDir}
 *     onSort={toggleSort}
 *   />
 */
import type { ReactNode } from 'react'
import type { SortDir } from './useSort'

interface SortableThProps {
  label: ReactNode
  sortKey: string
  currentSortKey: string
  sortDir: SortDir
  onSort: (key: string) => void
  className?: string
}

export function SortableTh({
  label,
  sortKey,
  currentSortKey,
  sortDir,
  onSort,
  className = '',
}: SortableThProps) {
  const isActive = sortKey === currentSortKey
  const indicator = isActive ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ▲▼'
  const indicatorClass = isActive
    ? 'text-blue-600'
    : 'text-gray-300 opacity-50 group-hover:opacity-100'

  return (
    <th
      scope="col"
      className={`p-3 text-right bg-gray-50 text-gray-600 font-medium border-b cursor-pointer select-none group hover:bg-gray-100 ${className}`}
      onClick={() => onSort(sortKey)}
      aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <span>{label}</span>
        <span className={`text-xs ${indicatorClass}`}>{indicator}</span>
      </span>
    </th>
  )
}
