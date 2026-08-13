/**
 * src/components/ui/useUrlState.ts
 *
 * Persists a piece of UI state in the URL's query string so that:
 *   - The back/forward buttons restore the user's filters
 *   - A page refresh keeps the filters
 *   - A user can bookmark a filtered view
 *   - Sharing the URL lets others see the same view
 *
 * Usage:
 *   const [search, setSearch] = useUrlState('q', '')
 *   const [status, setStatus] = useUrlState('status', 'all')
 *
 * The hook replaces useState — same setter semantics. The URL is updated
 * via `setSearchParams` from react-router-dom, which uses `replace: true`
 * by default to avoid polluting browser history on every keystroke.
 */
import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useUrlState(key: string, defaultValue: string): [string, (v: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  const value = searchParams.get(key) ?? defaultValue

  const setValue = useCallback(
    (v: string) => {
      setSearchParams(
        (prev) => {
          // If the new value equals the default, drop the param so URLs
          // stay clean (no `?status=all` clutter).
          if (v === defaultValue || v === '') {
            prev.delete(key)
          } else {
            prev.set(key, v)
          }
          return prev
        },
        { replace: true },
      )
    },
    [key, defaultValue, setSearchParams],
  )

  return [value, setValue]
}
