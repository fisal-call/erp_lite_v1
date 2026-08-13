/**
 * src/components/ui/EmptyState.tsx
 * Standard "no data" placeholder. Used inside tables, lists, and dashboard widgets.
 */
export function EmptyState({ message = 'لا توجد بيانات' }: { message?: string }) {
  return (
    <div className="text-center text-gray-400 py-8 text-sm" role="status">
      <div className="mb-2 text-3xl" aria-hidden="true">∅</div>
      {message}
    </div>
  )
}
