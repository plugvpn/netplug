import { NextResponse } from 'next/server'
import { isSetupComplete } from '@/lib/setup'
import { secureSetupCookie } from '@/lib/setup-cookie'

export async function GET() {
  try {
    const setupComplete = await isSetupComplete()
    const baseUrl = process.env.BASE_URL || process.env.AUTH_URL || 'http://localhost:3000'

    const response = NextResponse.redirect(new URL('/dashboard', baseUrl))

    if (setupComplete) {
      // Set cookie to track setup completion
      response.cookies.set('setup-complete', 'true', {
        httpOnly: true,
        secure: secureSetupCookie(),
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: '/',
      })
    }

    return response
  } catch (error) {
    console.error('Error verifying setup:', error)
    const baseUrl = process.env.BASE_URL || process.env.AUTH_URL || 'http://localhost:3000'
    return NextResponse.redirect(new URL('/setup', baseUrl))
  }
}
