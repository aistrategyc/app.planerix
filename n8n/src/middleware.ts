import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// List of paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/verify-email',
  '/landing',
  '/terms',
  '/privacy',
  '/', // Landing page
  '/invitations', // Allow invitation links
]

// Paths that should redirect authenticated users away (e.g., login page)
const AUTH_ONLY_PATHS = ['/login', '/register']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response=NextResponse.next()
  if (request.mode==="cors"){
    response.headers.set ('Access-Control-Allow-Origin', request.nextUrl.protocol+'//'+request.headers.get('host'))
    response.headers.set ('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set ('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set ('Access-Control-Allow-Credentials', 'true')
  }
  const redir=request.nextUrl.protocol+"//"+request.headers.get('host')+request.nextUrl.pathname+request.nextUrl.search;
//   console.log("===============================",NextResponse,'==========================================')
//   console.log("WARNING:", request.url,redir)//[request.nextUrl,request.url,redir])

  // Allow static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check if path is public
  const isPublicPath = PUBLIC_PATHS.some(path =>
    pathname === path || pathname.startsWith(`${path}/`)
  )

  // Check for authentication token in cookies (access/refresh)
  const accessTokenValue = request.cookies.get('access_token')?.value
  const hasAccessToken = Boolean(accessTokenValue && !isAccessTokenExpired(accessTokenValue))
  const refreshCookieName = process.env.NEXT_PUBLIC_REFRESH_COOKIE_NAME || 'lrx_refresh'
  const hasRefreshToken = Boolean(request.cookies.get(refreshCookieName)?.value)
  const hasLocalStorageToken = request.headers.get('x-has-token') === 'true'

  // "Strong" auth only when we have access/local token (not just refresh).
  // Refresh-only should allow protected pages so client can refresh.
  const isAuthenticatedStrong = hasAccessToken || hasLocalStorageToken
  const isAuthenticated = isAuthenticatedStrong || hasRefreshToken

  // If trying to access auth-only page (login/register) while authenticated
  if (AUTH_ONLY_PATHS.includes(pathname) && isAuthenticatedStrong) {
    return NextResponse.redirect(new URL('/dashboard', redir))
  }

  // If not authenticated and trying to access protected route
  if (!isPublicPath && !isAuthenticated) {
    const loginUrl = new URL('/login', redir)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

function isAccessTokenExpired(token: string): boolean {
  try {
    const raw = token.startsWith("Bearer ") ? token.slice(7) : token
    const [, payload] = raw.split('.')
    if (!payload) return true
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    const decoded = JSON.parse(atob(padded))
    const exp = typeof decoded?.exp === 'number' ? decoded.exp : null
    if (!exp) return true
    return Date.now() / 1000 >= exp
  } catch {
    return true
  }
}

// Configure which routes middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
}
