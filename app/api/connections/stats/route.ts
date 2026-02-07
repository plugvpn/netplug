import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Get connection statistics from database
 * Background sync service updates this data every 10 seconds
 */
export async function GET() {
  try {
    // Get all VPN users (query database only)
    const allUsers = await prisma.vPNUser.count({
      where: {
        server: {
          protocol: 'wireguard',
        },
      }
    })

    // Get enabled users
    const enabledUsers = await prisma.vPNUser.count({
      where: {
        isEnabled: true,
        server: {
          protocol: 'wireguard',
        },
      }
    })

    // Get connected users (synced by background service)
    const connectedUsers = await prisma.vPNUser.count({
      where: {
        isConnected: true,
        isEnabled: true,
        server: {
          protocol: 'wireguard',
        },
      }
    })

    // Available connections = enabled users that are not connected
    const availableConnections = enabledUsers - connectedUsers

    return NextResponse.json({
      inUse: connectedUsers,
      available: availableConnections,
      total: enabledUsers,
      disabled: allUsers - enabledUsers,
    })
  } catch (error) {
    console.error('Error getting connection stats:', error)
    return NextResponse.json(
      { error: 'Failed to get connection statistics' },
      { status: 500 }
    )
  }
}
