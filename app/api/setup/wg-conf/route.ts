import { NextRequest, NextResponse } from 'next/server'
import { markSetupComplete, isSetupComplete } from '@/lib/setup'
import { initializeWireGuard } from '@/lib/wireguard/sync-service'
import {
  parseWgQuickServerConf,
  firstAddressCidr,
  inferClientAddressRange,
} from '@/lib/wireguard/parse-wg-conf'
import { wgPubkeyFromPrivate } from '@/lib/wireguard/wg-pubkey'
import fs from 'fs/promises'
import path from 'path'

const MAX_CONF_BYTES = 256 * 1024

export async function POST(request: NextRequest) {
  try {
    if (await isSetupComplete()) {
      return NextResponse.json(
        { error: 'Setup has already been completed' },
        { status: 400 }
      )
    }

    const form = await request.formData()
    const file = form.get('file')
    const serverHost = String(form.get('serverHost') ?? '').trim()

    if (!serverHost) {
      return NextResponse.json(
        {
          error:
            'Server host (public hostname or IP for clients) is required when using an uploaded config',
        },
        { status: 400 }
      )
    }

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: 'Please choose a wg0.conf file to upload' },
        { status: 400 }
      )
    }

    if (file.size > MAX_CONF_BYTES) {
      return NextResponse.json(
        { error: 'Config file is too large' },
        { status: 400 }
      )
    }

    const raw = await file.text()
    let parsed
    try {
      parsed = parseWgQuickServerConf(raw)
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || 'Invalid WireGuard configuration file' },
        { status: 400 }
      )
    }

    const { cidr, serverIp } = firstAddressCidr(parsed.interface.addressRaw)
    const clientAddressRange = inferClientAddressRange(cidr)

    let publicKey: string
    try {
      publicKey = await wgPubkeyFromPrivate(parsed.interface.privateKey)
    } catch {
      return NextResponse.json(
        {
          error:
            'Could not derive server public key from the config. Check that WireGuard tools (wg) are installed and the PrivateKey is valid.',
        },
        { status: 400 }
      )
    }

    const port = parsed.interface.listenPort
    if (isNaN(port) || port < 1 || port > 65535) {
      return NextResponse.json(
        { error: 'Invalid ListenPort in configuration' },
        { status: 400 }
      )
    }

    const dataDir = process.env.DATA_DIR
    if (!dataDir) {
      return NextResponse.json(
        { error: 'DATA_DIR is not configured on the server' },
        { status: 500 }
      )
    }

    const configPath = path.join(dataDir, 'wg0.conf')
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(configPath, raw, 'utf-8')
    await fs.chmod(configPath, 0o600)

    const firstPeerKeepalive = parsed.peers.find(
      (p) =>
        p.persistentKeepalive !== undefined && !isNaN(p.persistentKeepalive!)
    )?.persistentKeepalive

    const vpnConfiguration: Record<string, unknown> = {
      wireGuard: {
        enabled: true,
        configSource: 'uploaded',
        serverHost,
        serverPort: port,
        serverAddress: serverIp,
        clientAddressRange,
        dns:
          parsed.interface.dns?.replace(/\s*,\s*/g, ', ') ||
          '1.1.1.1, 1.0.0.1',
        mtu:
          parsed.interface.mtu !== undefined && !isNaN(parsed.interface.mtu)
            ? parsed.interface.mtu
            : 1420,
        persistentKeepalive:
          firstPeerKeepalive !== undefined && !isNaN(firstPeerKeepalive)
            ? firstPeerKeepalive
            : 25,
        allowedIps: '0.0.0.0/0, ::/0',
        postUp: parsed.interface.postUp || '',
        postDown: parsed.interface.postDown || '',
        ...(parsed.interface.fwMark !== undefined &&
        !isNaN(parsed.interface.fwMark)
          ? { fwMark: parsed.interface.fwMark }
          : {}),
      },
    }

    await markSetupComplete(vpnConfiguration)

    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    try {
      await prisma.vPNServer.upsert({
        where: { id: 'wireguard' },
        update: {
          name: 'WireGuard Server',
          protocol: 'wireguard',
          host: serverHost,
          port,
          configPath,
          isActive: true,
          privateKey: parsed.interface.privateKey,
          publicKey,
        },
        create: {
          id: 'wireguard',
          name: 'WireGuard Server',
          protocol: 'wireguard',
          host: serverHost,
          port,
          configPath,
          isActive: true,
          privateKey: parsed.interface.privateKey,
          publicKey,
        },
      })
    } finally {
      await prisma.$disconnect()
    }

    try {
      await initializeWireGuard('wg0')
    } catch (error) {
      console.error('[Setup] Failed to bring up WireGuard after upload:', error)
      console.warn(
        '[Setup] You may need to run wg-quick up manually with sufficient privileges'
      )
    }

    const response = NextResponse.json({
      success: true,
      message: 'Setup completed using uploaded wg0.conf',
    })

    response.cookies.set('setup-complete', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Error applying uploaded wg0.conf:', error)
    return NextResponse.json(
      { error: 'Failed to apply WireGuard configuration' },
      { status: 500 }
    )
  }
}
