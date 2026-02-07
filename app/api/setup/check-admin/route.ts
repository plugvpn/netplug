import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Check if any admin user exists
    const adminCount = await prisma.user.count({
      where: { role: 'admin' }
    })

    return NextResponse.json({
      hasAdmin: adminCount > 0,
    })
  } catch (error) {
    console.error('Error checking for admin user:', error)
    return NextResponse.json(
      { error: 'Failed to check admin status' },
      { status: 500 }
    )
  }
}
