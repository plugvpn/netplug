import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Get active connections from database
 * Background sync service updates this data every 10 seconds
 */
export async function GET() {
  try {
    // Query database for connected users
    // This is fast and doesn't require running wg commands
    const activeConnections = await prisma.vPNUser.findMany({
      where: {
        isConnected: true,
        isEnabled: true,
        server: {
          protocol: 'wireguard',
        }
      },
      include: {
        server: true
      },
      orderBy: {
        connectedAt: 'desc',
      }
    })

    // Format the data for the frontend
    // Show only current session usage (not all-time)
    const formattedConnections = activeConnections.map(user => {
      // Type assertion for fields that exist in DB but may not be in generated types yet
      const userData = user as any;

      return {
        id: user.id,
        username: user.username,
        ipAddress: user.ipAddress || 'N/A',
        endpoint: userData.endpoint || null,
        lastHandshake: userData.lastHandshake?.toISOString() || null,
        bytesReceived: user.bytesReceived.toString(),
        bytesSent: user.bytesSent.toString(),
        serverName: user.server.name,
        protocol: user.server.protocol,
        serverHost: user.server.host,
        serverPort: user.server.port,
      };
    })

    return NextResponse.json(formattedConnections)
  } catch (error) {
    console.error('Error getting active connections:', error)
    return NextResponse.json(
      { error: 'Failed to get active connections' },
      { status: 500 }
    )
  }
}
