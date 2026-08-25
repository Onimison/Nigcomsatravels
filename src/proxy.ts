import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { ROLE_DASHBOARD_PATHS, ROUTE_ACCESS } from '@/lib/utils/constants'
import type { UserRole } from '@/types/database'

/**
 * Proxy (Next.js 16 replacement for middleware) — PRD Section 2.2
 *
 * Responsibilities:
 * 1. Refresh Supabase auth session on every request (cookie management)
 * 2. Redirect unauthenticated users to /login
 * 3. Redirect authenticated users away from auth pages to their dashboard
 * 4. Block a route a signed-in user doesn't have the role for — before
 *    anything under it renders. RLS remains the real security boundary
 *    (PRD Section 7.1); this exists so the wrong dashboard never so much
 *    as flashes on screen, which is a UX/perceived-security requirement
 *    RLS alone can't give you.
 *
 * The role/active lookup below only runs for requests under one of the
 * four dashboard roots (`staff`/`hr`/`md`/`admin`), not on every request —
 * a deliberate, scoped exception to "don't query the DB in Proxy."
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

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

  // Triggers the actual session refresh (and cookie write via setAll above)
  // — merely constructing the client above does neither on its own.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/verify-otp')
  const isApiRoute = pathname.startsWith('/api')

  if (isApiRoute) {
    return response
  }

  const dashboardSection = (Object.keys(ROUTE_ACCESS) as (keyof typeof ROUTE_ACCESS)[]).find(
    (section) => pathname === `/${section}` || pathname.startsWith(`/${section}/`)
  )

  if (isAuthPage) {
    // Signed-in, active users don't need the login/OTP forms — send them
    // straight to their own dashboard instead of re-showing the auth flow.
    if (user) {
      const { data: staff } = await supabase.from('staff').select('role, active').eq('id', user.id).single()
      if (staff?.active) {
        return NextResponse.redirect(new URL(ROLE_DASHBOARD_PATHS[staff.role as UserRole], request.url))
      }
    }
    return response
  }

  if (!dashboardSection) {
    return response
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: staff } = await supabase.from('staff').select('role, active').eq('id', user.id).single()

  const allowed = staff?.active && ROUTE_ACCESS[dashboardSection].includes(staff.role as UserRole)
  if (!allowed) {
    // `/__blocked` isn't a real route, so Next falls through to the nearest
    // not-found.tsx and serves a genuine 404 — the target page's server
    // component, data fetches, and loading skeleton never run. A wrong-role
    // visit and a typo'd URL are indistinguishable, on purpose.
    return NextResponse.rewrite(new URL('/__blocked', request.url))
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
