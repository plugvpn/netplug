import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default async function proxy(request: NextRequest) {
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

  // Check authentication via session cookie
  const hasSession = request.cookies.get('authjs.session-token') ||
                     request.cookies.get('__Secure-authjs.session-token')

  // Check setup completion via cookie
  const setupComplete = request.cookies.get('setup-complete')?.value === 'true'

  // If not authenticated and not on login page, redirect to login
  if (!hasSession && pathname !== '/login') {
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
