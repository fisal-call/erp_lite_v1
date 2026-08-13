/**
 * src/components/ui/Toast.tsx
 *
 * Lightweight toast notification system.
 *
 * Usage:
 *   // At app root (inside providers):
 *   <ToastProvider>
 *     <App />
 *   </ToastProvider>
 *
 *   // Anywhere inside:
 *   const toast = useToast()  // imported from '../../components/ui'
 *   toast.success('تم حفظ العميل')
 *   toast.error('فشل الحفظ')
 *
 * Implementation notes:
 *   - Pure CSS + React state (no external lib needed)
 *   - Auto-dismiss after `duration` ms (default 4s)
 *   - RTL-friendly: appears in top-left corner (which is the visual "end" in RTL)
 *   - aria-live="polite" for screen readers
 *   - Stacks vertically with smooth transitions
 *
 * Non-component exports (context + hook + types) live in `./toast-state` so
 * this file is components-only (Fast Refresh friendly) — same pattern used
 * by `auth/auth-state.ts`.
 */
import { useCallback, useState, type ReactNode } from 'react'
import { ToastContext, type ToastContextValue, type ToastTone } from './toast-state'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-rose-50 border-rose-200 text-rose-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
}

const TONE_ICONS: Record<ToastTone, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '!',
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, message: string, durationMs = 4000) => {
      const id = nextId++
      setToasts((prev) => [...prev, { id, tone, message }])
      // Auto-dismiss after duration (unless durationMs is 0)
      if (durationMs > 0) {
        setTimeout(() => remove(id), durationMs)
      }
    },
    [remove],
  )

  const ctx: ToastContextValue = {
    push,
    success: (m, d) => push('success', m, d),
    error: (m, d) => push('error', m, d),
    info: (m, d) => push('info', m, d),
    warning: (m, d) => push('warning', m, d),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-4 left-4 z-[60] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2 px-4 py-2.5 rounded-md border shadow-md text-sm max-w-sm pointer-events-auto ${TONE_STYLES[t.tone]}`}
            role="status"
          >
            <span className="font-bold select-none" aria-hidden="true">
              {TONE_ICONS[t.tone]}
            </span>
            <span className="flex-1 leading-relaxed">{t.message}</span>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="text-current opacity-50 hover:opacity-100 px-1"
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
