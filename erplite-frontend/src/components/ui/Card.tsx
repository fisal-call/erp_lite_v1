/**
 * src/components/ui/Card.tsx
 * Standard surface container used across the app — clean white card with
 * subtle shadow, soft corners, and small inner padding. Implements the
 * "Modern Professional Enterprise ERP" look without overdoing it.
 */
import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-100 ${padded ? 'p-4' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
