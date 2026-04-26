import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSetupComplete } from '@/lib/setup'

export async function GET() {
  try {
    // Check if any admin user exists
    const adminCount = await prisma.user.count({
      where: { role: 'admin' }
    })

    const setupComplete = await isSetupComplete()

    return NextResponse.json({
      hasAdmin: adminCount > 0,
      setupComplete,
    })
  } catch (error) {
    console.error('Error checking for admin user:', error)
    return NextResponse.json(
      { error: 'Failed to check admin status' },
      { status: 500 }
    )
  }
}
