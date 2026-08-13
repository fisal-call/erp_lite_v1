/**
 * src/components/ui/Table.tsx
 * Mobile-responsive table wrapper. On narrow screens, tables scroll
 * horizontally instead of breaking layout. Cell padding is consistent.
 *
 * Usage: just wrap a normal <table>. Children render inside a
 * `<div class="overflow-x-auto">` so columns always keep their natural
 * width and the page never overflows.
 */
import type { ReactNode } from 'react'

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`p-3 text-right bg-gray-50 text-gray-600 font-medium border-b ${className}`}>
      {children}
    </th>
  )
}

export function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`p-3 border-b border-gray-100 ${className}`}>{children}</td>
}
