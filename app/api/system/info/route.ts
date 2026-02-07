import { NextResponse } from 'next/server'
import os from 'os'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get system information
    const hostname = os.hostname()
    const platform = os.platform()
    const release = os.release()
    const type = os.type()

    // Get network interfaces to find server address
    const networkInterfaces = os.networkInterfaces()
    let serverAddress = '127.0.0.1'

    // Find first non-internal IPv4 address
    for (const [, addresses] of Object.entries(networkInterfaces)) {
      if (addresses) {
        for (const addr of addresses) {
          if (addr.family === 'IPv4' && !addr.internal) {
            serverAddress = addr.address
            break
          }
        }
      }
      if (serverAddress !== '127.0.0.1') break
    }

    // Get version from package.json or environment
    const version = process.env.APP_VERSION || '1.0.0'

    // Get OS name with more details
    let osName = `${type} ${release}`
    if (platform === 'linux') {
      try {
        const { execSync } = require('child_process')
        const lsbRelease = execSync('lsb_release -d 2>/dev/null || cat /etc/os-release 2>/dev/null | grep PRETTY_NAME', { encoding: 'utf8' })
        const match = lsbRelease.match(/(?:Description:\s*|PRETTY_NAME=")([^"]+)/)
        if (match) {
          osName = match[1]
        }
      } catch {
        // Fallback to basic OS info if command fails
      }
    }

    // Get active VPN servers from database
    const vpnServers = await prisma.vPNServer.findMany({
      where: { isActive: true },
      select: {
        protocol: true,
        port: true,
      }
    })

    // Build ports list
    const ports: string[] = []
    vpnServers.forEach(server => {
      if (server.port) {
        const protocol = server.protocol === 'wireguard' ? 'udp' : 'tcp'
        ports.push(`${protocol}/${server.port}`)
      }
    })

    return NextResponse.json({
      serverAddress,
      version,
      osName,
      hostname,
      acceptingConnectionsOn: 'all',
      ports: ports.length > 0 ? ports.join(', ') : 'tcp/443, udp/1194',
    })
  } catch (error) {
    console.error('Error getting system info:', error)
    return NextResponse.json(
      { error: 'Failed to get system information' },
      { status: 500 }
    )
  }
}
