import { Skeleton } from '@/components/ui/skeleton'

/** Shaped like the single ReviewCard it stands in for. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />
      <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  )
}
