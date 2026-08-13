/**
 * src/components/ui/ConfirmDialog.tsx
 * Lightweight modal used before sensitive operations (e.g. document submit).
 * Pure CSS + React state — no external UI lib needed. RTL-friendly.
 */
import type { ReactNode } from 'react'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  onConfirm,
  onCancel,
  busy = false,
  danger = false,
}: {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  danger?: boolean
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5 space-y-3">
        <h2 id="confirm-title" className="text-base font-bold text-gray-800">
          {title}
        </h2>
        {description && <div className="text-sm text-gray-600">{description}</div>}
        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-3 py-1.5 text-sm rounded-md text-white disabled:opacity-50 ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {busy ? 'جاري التنفيذ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
