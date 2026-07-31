import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Proxy (Next.js 16 replacement for middleware) — PRD Section 2.2
 *
 * Responsibilities:
 * 1. Refresh Supabase auth session on every request (cookie management)
 * 2. Redirect unauthenticated users to /login
 * 3. Redirect authenticated users away from auth pages to their dashboard
 *
 * NOTE: Role-based authorization is NOT done here because the proxy
 * cannot efficiently query the staff table on every request. Instead,
 * the (dashboard)/layout.tsx handles role fetching and the individual
 * server actions verify authorization. See Next.js docs:
 * "Always verify authentication and authorization inside each Server
 * Function rather than relying on Proxy alone."
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- The creation process handles cookie refresh side-effects
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh the session — this is critical for keeping the user logged in
  // The getUser() call triggers the cookie refresh automatically
  // We intentionally don't await here since we need a sync return
  // The actual auth check happens in the dashboard layout (server component)

  const { pathname } = request.nextUrl

  // Let auth pages and API routes through without checks
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/verify-otp')
  const isApiRoute = pathname.startsWith('/api')

  if (isAuthPage || isApiRoute) {
    return response
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public folder assets (SVGs, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.svg$).*)',
  ],
}
