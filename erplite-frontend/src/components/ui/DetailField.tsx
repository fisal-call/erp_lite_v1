/**
 * src/components/ui/DetailField.tsx
 *
 * Read-only key/value row used inside detail pages. Replaces ad-hoc `<Row>`
 * helpers that were duplicated in CustomerDetailPage / SupplierDetailPage.
 *
 * Renders as a definition-list pair so screen-readers announce it as
 * "label: value".
 */
import type { ReactNode } from 'react'

export function DetailField({
  label,
  value,
  ltr = false,
}: {
  label: string
  value: ReactNode
  ltr?: boolean
}) {
  return (
    <div className="flex gap-3 text-sm border-b border-gray-50 py-2 last:border-0">
      <span className="text-gray-500 w-32 shrink-0">{label}</span>
      <span
        className={`text-gray-800 font-medium break-all ${
          ltr ? 'ltr-text font-mono text-xs' : ''
        }`}
      >
        {value === null || value === undefined || value === '' ? (
          <span className="text-gray-300">—</span>
        ) : (
          value
        )}
      </span>
    </div>
  )
}
