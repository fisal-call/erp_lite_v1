/**
 * src/components/StatusBadge.tsx
 * Matches the 7 base statuses from PDR-002 (ERP-004) — every document in the
 * system uses this exact set, so this one component covers all modules.
 */
const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-green-100 text-green-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
  closed: 'bg-blue-100 text-blue-700',
  archived: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS_AR: Record<string, string> = {
  draft: 'مسودة',
  submitted: 'معتمد',
  approved: 'معتمد',
  rejected: 'مرفوض',
  cancelled: 'ملغى',
  closed: 'مغلق',
  archived: 'مؤرشف',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-gray-100'}`}>
      {STATUS_LABELS_AR[status] ?? status}
    </span>
  )
}
