/**
 * src/components/ui/FilterBar.tsx
 *
 * Horizontal toolbar for list page filters + search. Renders as a single
 * responsive row that wraps on small screens. Includes a "clear filters"
 * button shown only when at least one filter is active.
 *
 * Usage:
 *   <FilterBar
 *     search={<input ... />}
 *     filters={<select ...>...</select>}
 *     onClear={() => { setSearch(''); setStatus('all') }}
 *     hasActiveFilters={!!search || status !== 'all'}
 *   />
 */
import type { ReactNode } from 'react'

export function FilterBar({
  search,
  filters,
  onClear,
  hasActiveFilters,
}: {
  search?: ReactNode
  filters?: ReactNode
  onClear: () => void
  hasActiveFilters: boolean
}) {
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      {search && <div className="flex-1 min-w-[200px] max-w-sm">{search}</div>}
      {filters}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded-md"
        >
          مسح الفلاتر
        </button>
      )}
    </div>
  )
}
