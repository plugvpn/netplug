import { NextRequest, NextResponse } from 'next/server'
import { markSetupComplete, isSetupComplete } from '@/lib/setup'
import { secureSetupCookie } from '@/lib/setup-cookie'
import { prisma } from '@/lib/prisma'
import { initializeWireGuard } from '@/lib/wireguard/sync-service'
import { writeWireGuardConfig } from '@/lib/wireguard/config-generator'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    // Check if setup is already complete
    const setupComplete = await isSetupComplete()
    if (setupComplete) {
      return NextResponse.json(
        { error: 'Setup has already been completed' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { wireGuard } = body

    // Validate that WireGuard is enabled
    if (!wireGuard?.enabled) {
      return NextResponse.json(
        { error: 'WireGuard VPN must be enabled' },
        { status: 400 }
      )
    }

    // Validate WireGuard configuration
    if (wireGuard?.enabled) {
      // Required fields
      if (!wireGuard.serverHost || !wireGuard.serverPort ||
          !wireGuard.serverAddress || !wireGuard.clientAddressRange) {
        return NextResponse.json(
          { error: 'WireGuard configuration is incomplete' },
          { status: 400 }
        )
      }

      // Validate key pair
      if (!wireGuard.privateKey || !wireGuard.publicKey) {
        return NextResponse.json(
          { error: 'WireGuard key pair is required' },
          { status: 400 }
        )
      }

      // Validate port number
      const port = parseInt(wireGuard.serverPort)
      if (isNaN(port) || port < 1 || port > 65535) {
        return NextResponse.json(
          { error: 'Invalid WireGuard port number' },
          { status: 400 }
        )
      }
    }

    // Save configuration and mark setup as complete
    const vpnConfiguration: any = {
      wireGuard: {
        enabled: true,
        // Server Settings
        serverHost: wireGuard.serverHost,
        serverPort: parseInt(wireGuard.serverPort),
        serverAddress: wireGuard.serverAddress,
        clientAddressRange: wireGuard.clientAddressRange,
        // DNS Settings
        dns: wireGuard.dns || '1.1.1.1, 1.0.0.1',
        // Network Settings
        mtu: parseInt(wireGuard.mtu) || 1420,
        persistentKeepalive: parseInt(wireGuard.persistentKeepalive) || 25,
        allowedIps: wireGuard.allowedIps || '0.0.0.0/0, ::/0',
        // Advanced
        postUp: wireGuard.postUp || '',
        postDown: wireGuard.postDown || '',
      },
    }

    // Add FwMark if provided
    if (wireGuard.fwMark) {
      vpnConfiguration.wireGuard.fwMark = parseInt(wireGuard.fwMark)
    }

    await markSetupComplete(vpnConfiguration)

    // Use the provided WireGuard key pair from the frontend
    const serverPrivateKey = wireGuard.privateKey
    const serverPublicKey = wireGuard.publicKey
    console.log('[WireGuard] Using provided key pair for server (wg0 interface)')

    await prisma.vPNServer.upsert({
      where: { id: 'wireguard' },
      update: {
        name: 'WireGuard Server',
        protocol: 'wireguard',
        host: wireGuard.serverHost,
        port: parseInt(wireGuard.serverPort),
        configPath: path.join(process.env.DATA_DIR || '/data', 'wg0.conf'),
        isActive: true,
        privateKey: serverPrivateKey,
        publicKey: serverPublicKey,
      },
      create: {
        id: 'wireguard',
        name: 'WireGuard Server',
        protocol: 'wireguard',
        host: wireGuard.serverHost,
        port: parseInt(wireGuard.serverPort),
        configPath: path.join(process.env.DATA_DIR || '/data', 'wg0.conf'),
        isActive: true,
        privateKey: serverPrivateKey,
        publicKey: serverPublicKey,
      },
    })

    console.log('[Setup] WireGuard server configuration saved')

    console.log('[Setup] Generating WireGuard configuration file...')
    const configWritten = await writeWireGuardConfig()

    if (!configWritten) {
      console.error('[Setup] Failed to write WireGuard configuration file')
    } else {
      console.log('[Setup] ✓ WireGuard configuration file created')

      console.log('[Setup] Bringing up WireGuard interface...')
      try {
        await initializeWireGuard('wg0')
        console.log('[Setup] ✓ WireGuard interface is up and running')
      } catch (error) {
        console.error('[Setup] Failed to bring up WireGuard interface:', error)
        console.warn('[Setup] You may need to run "sudo wg-quick up wg0" manually')
      }
    }

    // Create response with setup-complete cookie
    const response = NextResponse.json({
      success: true,
      message: 'Setup completed successfully',
    })

    // Set cookie to track setup completion (for middleware)
    response.cookies.set('setup-complete', 'true', {
      httpOnly: true,
      secure: secureSetupCookie(),
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Error saving VPN configuration:', error)
    return NextResponse.json(
      { error: 'Failed to save VPN configuration' },
      { status: 500 }
    )
  }
}
