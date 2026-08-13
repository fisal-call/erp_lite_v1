/**
 * src/components/ui/ErrorState.tsx
 * Standard error banner. Red background, Arabic text. Used in every page that
 * has data-fetching or mutations so error UX is consistent across modules.
 */
import { describeError } from '../../api/client'

export function ErrorState({ error, message }: { error?: unknown; message?: string }) {
  const text = message ?? describeError(error)
  return (
    <div
      role="alert"
      className="bg-red-50 text-red-700 text-sm p-3 rounded-md border border-red-200"
    >
      {text}
    </div>
  )
}
