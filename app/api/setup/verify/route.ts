import { NextResponse } from 'next/server'
import { isSetupComplete } from '@/lib/setup'

export async function GET() {
  try {
    const setupComplete = await isSetupComplete()

    const response = NextResponse.redirect(new URL('/dashboard', process.env.AUTH_URL || 'http://localhost:3000'))

    if (setupComplete) {
      // Set cookie to track setup completion
      response.cookies.set('setup-complete', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: '/',
      })
    }

    return response
  } catch (error) {
    console.error('Error verifying setup:', error)
    return NextResponse.redirect(new URL('/setup', process.env.AUTH_URL || 'http://localhost:3000'))
  }
}
