import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow API routes, static files, and public assets
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/plug-icon.png')
  ) {
    return NextResponse.next()
  }

  // Check setup completion via cookie
  const setupComplete = request.cookies.get('setup-complete')?.value === 'true'

  // If setup is not complete, redirect to setup wizard
  if (!setupComplete) {
    if (!pathname.startsWith('/setup')) {
      return NextResponse.redirect(new URL('/setup', request.url))
    }
    return NextResponse.next()
  }

  // If setup is complete and user tries to access setup, redirect to dashboard
  if (pathname.startsWith('/setup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Check authentication via session cookie
  const hasSession = request.cookies.get('authjs.session-token') ||
                     request.cookies.get('__Secure-authjs.session-token')

  // If accessing login page and already authenticated, redirect to dashboard
  if (pathname === '/login' && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // If not authenticated and not on login page, redirect to login
  if (!hasSession && pathname !== '/login') {
    const callbackUrl = encodeURIComponent(pathname)
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
