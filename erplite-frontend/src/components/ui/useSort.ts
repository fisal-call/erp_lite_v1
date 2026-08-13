/**
 * src/components/ui/useSort.ts
 *
 * Client-side sort hook for list pages. Returns the current sort key +
 * direction plus a `sortData` helper that takes an array and returns a
 * sorted copy (immutable). Works for string, number, Date, and nullish
 * values — nulls/undefined always sort last regardless of direction.
 *
 * Usage:
 *   const { sortKey, sortDir, toggleSort, sortData } = useSort<T>('created_at', 'desc')
 *   const sorted = sortData(rows, (row) => row.created_at)
 *
 * The initial `sortKey` should be the user's most-expected default column
 * (e.g. document_date desc for documents, customer_name asc for masters).
 *
 * Note: `sortData` does not memoize internally — callers should wrap the
 * result in `useMemo` if they need referential stability for downstream
 * effects. In practice the input array comes from React Query and is
 * already referentially stable between renders.
 */
import { useState } from 'react'

export type SortDir = 'asc' | 'desc'

export interface UseSortResult<T> {
  sortKey: string
  sortDir: SortDir
  toggleSort: (key: string) => void
  sortData: <V>(data: readonly T[], accessor: (row: T) => V) => T[]
}

export function useSort<T>(initialKey: string, initialDir: SortDir = 'asc'): UseSortResult<T> {
  const [sortKey, setSortKey] = useState(initialKey)
  const [sortDir, setSortDir] = useState<SortDir>(initialDir)

  function toggleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function sortData<V>(data: readonly T[], accessor: (row: T) => V): T[] {
    const dirMul = sortDir === 'asc' ? 1 : -1
    return [...data].sort((a, b) => {
      const av = accessor(a)
      const bv = accessor(b)
      // nulls/undefined always sort last regardless of direction
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return -1 * dirMul
      if (av > bv) return 1 * dirMul
      return 0
    })
  }

  return { sortKey, sortDir, toggleSort, sortData }
}

