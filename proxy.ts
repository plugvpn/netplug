import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isSetupComplete } from './lib/setup'

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths that don't require authentication
  const publicPaths = ['/', '/login', '/setup', '/setup/vpn-config']

  // Allow API routes, static files, public assets, and public paths
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/plug-icon.png') ||
    publicPaths.includes(pathname)
  ) {
    return NextResponse.next()
  }

  // Check authentication via session cookie
  const hasSession = request.cookies.get('authjs.session-token') ||
                     request.cookies.get('__Secure-authjs.session-token')

  // Check setup completion via database
  const setupComplete = await isSetupComplete()

  // If not authenticated and not on login/setup pages, redirect to login
  if (!hasSession) {
    const callbackUrl = encodeURIComponent(pathname)
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url))
  }

  // If authenticated, check setup status
  if (hasSession) {
    // If setup is not complete and not accessing /setup, redirect to setup
    if (!setupComplete && !pathname.startsWith('/setup')) {
      return NextResponse.redirect(new URL('/setup/vpn-config', request.url))
    }

    // If setup is complete and trying to access setup, redirect to dashboard
    if (setupComplete && pathname.startsWith('/setup')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // If accessing login page and already authenticated
    if (pathname === '/login') {
      // Redirect based on setup status
      const redirectUrl = setupComplete ? '/dashboard' : '/setup/vpn-config'
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }
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
