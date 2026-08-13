/**
 * src/components/ui/Spinner.tsx
 * Small Arabic loading indicator used across pages.
 */
export function Spinner({ label = 'جاري التحميل...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-gray-500 text-sm" role="status" aria-live="polite">
      <svg
        className="animate-spin h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>{label}</span>
    </div>
  )
}
