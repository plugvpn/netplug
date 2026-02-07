import { NextResponse } from 'next/server'
import { getSetupStatus } from '@/lib/setup'

export async function GET() {
  try {
    const status = await getSetupStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error('Error getting setup status:', error)
    return NextResponse.json(
      { error: 'Failed to get setup status' },
      { status: 500 }
    )
  }
}
