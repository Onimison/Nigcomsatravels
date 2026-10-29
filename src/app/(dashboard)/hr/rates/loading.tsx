import { Skeleton } from '@/components/ui/skeleton'

/** Loading state for the read-only DTA policy reference. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-3 gap-4 py-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20 justify-self-end" />
              <Skeleton className="h-4 w-20 justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
