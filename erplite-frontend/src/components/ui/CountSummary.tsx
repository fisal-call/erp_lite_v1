/**
 * src/components/ui/CountSummary.tsx
 *
 * Small helper text above a table that says "عرض X من Y" with optional
 * status breakdown. Centralizes formatting so list pages don't each
 * reinvent this.
 */
export function CountSummary({
  shown,
  total,
  breakdown,
}: {
  shown: number
  total: number
  breakdown?: { label: string; count: number; tone?: 'green' | 'gray' | 'amber' | 'rose' }[]
}) {
  const toneClass: Record<string, string> = {
    green: 'text-emerald-700',
    gray: 'text-gray-500',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
  }
  return (
    <p className="text-xs text-gray-500 mb-3 flex flex-wrap items-center gap-3">
      <span>
        عرض <span className="font-bold text-gray-700">{shown}</span> من{' '}
        <span className="font-bold text-gray-700">{total}</span>
      </span>
      {breakdown && breakdown.length > 0 && (
        <span className="text-gray-300">|</span>
      )}
      {breakdown?.map((b) => (
        <span key={b.label} className={toneClass[b.tone ?? 'gray']}>
          {b.label}: {b.count}
        </span>
      ))}
    </p>
  )
}
