/**
 * Loading placeholder — an animated shimmer sweeping left-to-right over a
 * flat base, rather than a plain opacity pulse. The gradient/keyframes are
 * defined once in `globals.css` (`.skeleton-shimmer`/`@keyframes shimmer`)
 * so every skeleton across the app gets it for free.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-md bg-gray-200 dark:bg-gray-800 ${className}`} />
}
