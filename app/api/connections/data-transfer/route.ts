import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Get data transfer statistics from database
 * Background sync service updates this data every 10 seconds
 */
export async function GET() {
  try {
    // Get all VPN users for all-time stats
    const allUsers = await prisma.vPNUser.findMany({
      where: {
        server: {
          protocol: 'wireguard',
        },
      },
      select: {
        bytesReceived: true,
        bytesSent: true,
        totalBytesReceived: true,
        totalBytesSent: true,
      }
    })

    // Calculate all-time totals
    // Total (All Time) = cumulative from past sessions + current session
    let allTimeBytesReceived = BigInt(0)
    let allTimeBytesSent = BigInt(0)

    for (const user of allUsers) {
      // All-time includes cumulative from past sessions + current session
      allTimeBytesReceived += user.totalBytesReceived + user.bytesReceived
      allTimeBytesSent += user.totalBytesSent + user.bytesSent
    }

    return NextResponse.json({
      total: {
        received: allTimeBytesReceived.toString(),
        sent: allTimeBytesSent.toString(),
        combined: (allTimeBytesReceived + allTimeBytesSent).toString(),
      }
    })
  } catch (error) {
    console.error('Error getting data transfer stats:', error)
    return NextResponse.json(
      { error: 'Failed to get data transfer statistics' },
      { status: 500 }
    )
  }
}
