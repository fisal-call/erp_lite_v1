/**
 * src/components/ui/PageHeader.tsx
 * Standard page title row with optional action button (e.g. "new" button).
 * RTL-friendly: title on the right (start), actions on the left (end).
 */
import type { ReactNode } from 'react'

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
      <h1 className="text-xl font-bold text-gray-800">{title}</h1>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}
