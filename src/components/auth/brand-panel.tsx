/**
 * Left-hand brand panel shown alongside the login / verify-otp cards.
 * Static Server Component — matches the reference design in ui-images/.
 * Hidden below `lg` so the form card gets full width on phones/tablets.
 */

import { EyeMark, PlaneIcon, LockIcon, ChartIcon, ShieldCheckIcon } from './icons'

const FEATURES = [
  { icon: PlaneIcon, label: 'Travel request & approval workflow' },
  { icon: LockIcon, label: 'Passwordless secure authentication' },
  { icon: ChartIcon, label: 'Executive dashboard & analytics' },
]

export function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-100 px-12 py-14 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950 lg:flex lg:w-[46%] lg:flex-col">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
          <EyeMark className="h-5 w-5 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-50">NIGCOMSAT</p>
          <p className="text-xs font-semibold tracking-widest text-blue-600 dark:text-blue-400">TRAVELS</p>
        </div>
      </div>

      <div className="mt-14 max-w-md">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white/70 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-700 dark:border-blue-900/60 dark:bg-white/5 dark:text-blue-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          INTERNAL ENTERPRISE PLATFORM
        </span>

        <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-gray-900 dark:text-gray-50">
          Official Travel <span className="text-blue-600 dark:text-blue-400">Management</span> System
        </h1>

        <p className="mt-4 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
          Manage official travel requests, approvals and compliance securely and efficiently — from request to reimbursement.
        </p>

        <ul className="mt-8 space-y-2.5">
          {FEATURES.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2.5 rounded-full border border-blue-100 bg-white/70 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
            >
              <Icon className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              {label}
            </li>
          ))}
        </ul>

        <div className="mt-10 border-t border-blue-200/70 pt-4 dark:border-white/10">
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-500">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            FG-compliant · ISO 27001 aligned · Audit-logged
          </p>
        </div>
      </div>

      {/* Illustration: satellite dish + flight path, echoing the reference art without copying it 1:1 */}
      <svg
        viewBox="0 0 400 220"
        className="pointer-events-none absolute -bottom-6 left-1/2 h-auto w-[85%] max-w-md -translate-x-1/2 text-blue-600/25 dark:text-blue-400/15"
        aria-hidden="true"
      >
        <path d="M30 90 L110 55 L150 70 L190 45" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 5" fill="none" />
        <path d="M175 40 l15 5 -4 15 -15 -8Z" fill="currentColor" />
        <circle cx="35" cy="92" r="2" fill="currentColor" />
        <circle cx="70" cy="75" r="1.5" fill="currentColor" />
        <path
          d="M120 210 L280 210 L245 130 Q200 105 155 130 Z"
          fill="currentColor"
          opacity="0.5"
        />
        <line x1="200" y1="130" x2="200" y2="90" stroke="currentColor" strokeWidth="2" />
        <circle cx="200" cy="86" r="5" fill="currentColor" />
        <rect x="185" y="210" width="30" height="10" rx="2" fill="currentColor" opacity="0.6" />
      </svg>
    </div>
  )
}
