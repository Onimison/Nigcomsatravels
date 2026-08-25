import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton'

export default function Loading() {
  return <DashboardSkeleton statTiles={3} sections={2} />
}
