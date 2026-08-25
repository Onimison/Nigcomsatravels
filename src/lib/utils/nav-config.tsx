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
  CashIcon,
} from '@/components/ui/icons'

export interface NavItem {
  href: string
  label: string
  /**
   * Rendered icon element, not a component reference — this config is
   * imported by a Server Component (dashboard layout.tsx) and handed to a
   * Client Component (Sidebar). Bare component functions can't cross that
   * boundary as props (React can only serialize already-rendered output),
   * so icons are rendered here on the server and passed down as elements.
   */
  icon: React.ReactNode
  /** Key into the per-role badge-count map computed server-side in layout.tsx. */
  badgeKey?: 'pending'
}

export const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  staff: [
    { href: '/staff', label: 'Dashboard', icon: <GridIcon /> },
    { href: '/staff/request', label: 'Request Travel', icon: <PlaneIcon /> },
    { href: '/staff/pending', label: 'Pending Requests', icon: <ClockIcon />, badgeKey: 'pending' },
    { href: '/staff/history', label: 'Travel History', icon: <HistoryIcon /> },
    { href: '/staff/profile', label: 'Profile', icon: <UserIcon /> },
  ],
  hr: [
    { href: '/hr', label: 'Dashboard', icon: <GridIcon /> },
    { href: '/hr/requests', label: 'Review Queue', icon: <ClockIcon />, badgeKey: 'pending' },
    { href: '/hr/history', label: 'Recently Processed', icon: <HistoryIcon /> },
    { href: '/hr/rates', label: 'Flight Prices', icon: <CashIcon /> },
  ],
  md: [
    { href: '/md', label: 'Approvals', icon: <ClockIcon />, badgeKey: 'pending' },
  ],
  admin: [
    { href: '/admin?tab=staff', label: 'Staff Management', icon: <UsersIcon /> },
    { href: '/admin?tab=levels', label: 'Levels', icon: <TagIcon /> },
    { href: '/admin?tab=rates', label: 'Rates', icon: <CashIcon /> },
  ],
}
