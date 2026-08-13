/**
 * src/components/ui/toast-state.ts
 *
 * All non-component exports for the Toast module live here so that
 * `Toast.tsx` can be a "components-only" file (satisfies the
 * react/only-export-components rule for Fast Refresh correctness) —
 * exactly the same pattern used by `auth/auth-state.ts`.
 */
import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastContextValue {
  push: (tone: ToastTone, message: string, durationMs?: number) => void
  success: (message: string, durationMs?: number) => void
  error: (message: string, durationMs?: number) => void
  info: (message: string, durationMs?: number) => void
  warning: (message: string, durationMs?: number) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
