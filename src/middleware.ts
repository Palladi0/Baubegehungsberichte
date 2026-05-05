import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase-middleware'
import { createClient } from '@supabase/supabase-js'

// Simple in-memory rate limit map — sufficient for single-instance (single-VPS) deployments.
// In a multi-instance setup this would need a shared store (e.g. Redis). Accepted as-is (BUG-002).
// Key: IP, Value: array of request timestamps (ms).
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 10

// Separate, more permissive rate limit for project mutations (POST/PUT/PATCH/DELETE).
const rateLimitMutationMap = new Map<string, number[]>()
const RATE_LIMIT_MUTATION_MAX = 30

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(ip) ?? []
  const recent = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, recent)
    return false
  }
  recent.push(now)
  rateLimitMap.set(ip, recent)
  return true
}

function checkRateLimitMutation(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMutationMap.get(ip) ?? []
  const recent = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MUTATION_MAX) {
    rateLimitMutationMap.set(ip, recent)
    return false
  }
  recent.push(now)
  rateLimitMutationMap.set(ip, recent)
  return true
}

function isPublicPath(pathname: string): boolean {
  if (pathname === '/login') return true
  if (pathname.startsWith('/api/webhooks/')) return true
  if (pathname.startsWith('/_next/')) return true
  if (pathname.startsWith('/favicon')) return true
  if (pathname.startsWith('/api/auth/')) return true
  return false
}

function isRateLimitedPath(pathname: string, method: string): boolean {
  if (pathname.startsWith('/api/auth/')) return true
  if (pathname === '/login' && method === 'POST') return true
  return false
}

function isMutationRateLimitedPath(pathname: string, method: string): boolean {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  return isMutation && pathname.startsWith('/api/admin/projekte')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Rate limiting for auth endpoints
  if (isRateLimitedPath(pathname, method)) {
    const ip = getClientIp(request)
    if (!checkRateLimit(ip)) {
      const res = NextResponse.json(
        { error: 'Zu viele Anfragen. Bitte warten Sie einen Moment.' },
        { status: 429 }
      )
      addSecurityHeaders(res)
      return res
    }
  }

  // Rate limiting for project mutation endpoints
  if (isMutationRateLimitedPath(pathname, method)) {
    const ip = getClientIp(request)
    if (!checkRateLimitMutation(ip)) {
      const res = NextResponse.json(
        { error: 'Zu viele Anfragen. Bitte warten Sie einen Moment.' },
        { status: 429 }
      )
      addSecurityHeaders(res)
      return res
    }
  }

  // Create response that we can mutate cookies on
  const response = NextResponse.next({ request })
  addSecurityHeaders(response)

  // Public paths skip auth
  if (isPublicPath(pathname)) {
    return response
  }

  // Refresh session via supabase ssr middleware client
  const supabase = createMiddlewareClient(request, response)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Redirect to login, remember target
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('weiter', pathname)
    const redirect = NextResponse.redirect(redirectUrl)
    addSecurityHeaders(redirect)
    return redirect
  }

  // Admin-only routes need role check
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { data: profile } = await service
      .from('nutzer_profile')
      .select('rolle, aktiv')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.aktiv) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      const redirect = NextResponse.redirect(redirectUrl)
      addSecurityHeaders(redirect)
      return redirect
    }

    if (profile.rolle !== 'admin') {
      if (pathname.startsWith('/api/admin')) {
        const res = NextResponse.json(
          { error: 'Zugriff verweigert — Admin-Rolle erforderlich' },
          { status: 403 }
        )
        addSecurityHeaders(res)
        return res
      }
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/projekte'
      const redirect = NextResponse.redirect(redirectUrl)
      addSecurityHeaders(redirect)
      return redirect
    }
  }

  return response
}

function addSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin')
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  )
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files and images:
     * - _next/static, _next/image, favicon, public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
