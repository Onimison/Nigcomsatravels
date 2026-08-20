/**
 * Sidebar navigation, per role. Single source of truth so adding a route
 * later means editing this array, not four separate dashboard layouts.
 * See UI_UX_DESIGN_PLAN.md §2/§3.1.
 */

import type { UserRole } from '@/types/database'
import {
  GridIcon,
  PlaneIcon,
  ClockIcon,
  HistoryIcon,
  UserIcon,
  UsersIcon,
  TagIcon,
} from '@/components/ui/icons'

export interface NavItem {
  href: string
  label: string
  icon: typeof GridIcon
  /** Key into the per-role badge-count map computed server-side in layout.tsx. */
  badgeKey?: 'pending'
}

export const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  staff: [
    { href: '/staff', label: 'Dashboard', icon: GridIcon },
    { href: '/staff/request', label: 'Request Travel', icon: PlaneIcon },
    { href: '/staff/pending', label: 'Pending Requests', icon: ClockIcon, badgeKey: 'pending' },
    { href: '/staff/history', label: 'Travel History', icon: HistoryIcon },
    { href: '/staff/profile', label: 'Profile', icon: UserIcon },
  ],
  hr: [
    { href: '/hr', label: 'Review Queue', icon: ClockIcon, badgeKey: 'pending' },
  ],
  md: [
    { href: '/md', label: 'Approvals', icon: ClockIcon, badgeKey: 'pending' },
  ],
  admin: [
    { href: '/admin', label: 'Staff Management', icon: UsersIcon },
    { href: '/admin#levels', label: 'Levels & Rates', icon: TagIcon },
  ],
}
