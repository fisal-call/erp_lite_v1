/**
 * src/components/ui/BooleanBadge.tsx
 *
 * Small pill for true/false states (active/inactive, draft/submitted, etc.).
 * Centralizes the colors used across many list/detail pages so a future
 * design refresh only has to touch one file.
 */
const TRUE_STYLES = 'bg-emerald-100 text-emerald-700'
const FALSE_STYLES = 'bg-rose-100 text-rose-700'

export function BooleanBadge({
  value,
  trueLabel = 'نشط',
  falseLabel = 'موقوف',
}: {
  value: boolean
  trueLabel?: string
  falseLabel?: string
}) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        value ? TRUE_STYLES : FALSE_STYLES
      }`}
    >
      {value ? trueLabel : falseLabel}
    </span>
  )
}
