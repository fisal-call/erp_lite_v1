/**
 * src/components/ui/Skeleton.tsx
 *
 * Loading skeleton used inside cards / table rows / KPI tiles so users get
 * immediate visual feedback instead of just a centered spinner.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton lines={3} />
 */
interface SkeletonProps {
  className?: string
  lines?: number
}

export function Skeleton({ className = 'h-4 w-full', lines = 1 }: SkeletonProps) {
  if (lines === 1) {
    return <div className={`bg-gray-200 rounded animate-pulse ${className}`} aria-hidden="true" />
  }
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`bg-gray-200 rounded animate-pulse ${className} ${i === lines - 1 ? 'w-2/3' : ''}`}
        />
      ))}
    </div>
  )
}
