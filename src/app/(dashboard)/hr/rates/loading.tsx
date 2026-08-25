import { Skeleton } from '@/components/ui/skeleton'

/** Shaped like the Flight Price Reference it stands in for: two columns of price rows. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, col) => (
            <div key={col} className="space-y-3">
              <Skeleton className="h-3 w-24" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
