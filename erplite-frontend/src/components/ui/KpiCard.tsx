/**
 * src/components/ui/KpiCard.tsx
 * Dashboard KPI tile. Shows a label, a big number (or "غير متاح حالياً" when
 * the backend has no source for the metric), and an optional subtitle.
 *
 * Per spec §5: when no endpoint exists for a metric, the dashboard MUST show
 * "غير متاح حالياً" — never an invented number.
 */
import type { ReactNode } from 'react'

export function KpiCard({
  label,
  value,
  subtitle,
  available = true,
  tone = 'default',
}: {
  label: string
  value?: ReactNode
  subtitle?: string
  available?: boolean
  tone?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const toneClasses: Record<string, string> = {
    default: 'text-gray-800',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-rose-700',
  }
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      {available ? (
        <span className={`text-2xl font-bold ${toneClasses[tone]}`}>{value}</span>
      ) : (
        <span className="text-sm text-gray-400 mt-1">غير متاح حالياً</span>
      )}
      {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
    </div>
  )
}
