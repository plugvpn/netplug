import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import { execSync } from "child_process";

export async function GET() {
  try {
    // Get WireGuard configuration from SystemConfig
    const systemConfig = await prisma.systemConfig.findFirst();
    const vpnConfig = systemConfig?.vpnConfiguration as any;

    if (!vpnConfig?.wireGuard) {
      return NextResponse.json(
        { error: 'WireGuard configuration not found' },
        { status: 404 }
      );
    }

    // Get WireGuard server info
    let server = await prisma.vPNServer.findUnique({
      where: { id: 'wireguard' },
      select: {
        id: true,
        name: true,
        protocol: true,
        host: true,
        port: true,
        configPath: true,
        isActive: true,
        privateKey: true,
        publicKey: true,
      }
    });

    // If server has private key but no public key, derive it
    if (server && server.privateKey && !server.publicKey) {
      try {
        console.log('[WireGuard] Deriving public key from private key...');
        const publicKey = execSync(`echo "${server.privateKey}" | wg pubkey`, {
          encoding: 'utf-8',
          shell: '/bin/bash',
        }).trim();

        // Update the database with the derived public key
        await prisma.vPNServer.update({
          where: { id: 'wireguard' },
          data: { publicKey }
        });

        // Update the server object
        server = { ...server, publicKey };
        console.log('[WireGuard] Public key derived and saved successfully');
      } catch (error) {
        console.error('[WireGuard] Failed to derive public key:', error);
      }
    }

    // Override configPath with the correct DATA_DIR path
    const serverWithCorrectPath = server ? {
      ...server,
      configPath: path.join(process.env.DATA_DIR || '/data', 'wg0.conf')
    } : null;

    console.log('[WireGuard] Server public key exists:', !!server?.publicKey);

    return NextResponse.json({
      config: vpnConfig.wireGuard,
      server: serverWithCorrectPath,
    });
  } catch (error) {
    console.error('Failed to fetch WireGuard configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch WireGuard configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { config } = body;

    // Get current system config
    const systemConfig = await prisma.systemConfig.findFirst();

    if (!systemConfig) {
      return NextResponse.json(
        { error: 'System configuration not found' },
        { status: 404 }
      );
    }

    const vpnConfig = systemConfig.vpnConfiguration as any;

    // Update WireGuard configuration
    const updatedVpnConfig = {
      ...vpnConfig,
      wireGuard: {
        ...vpnConfig?.wireGuard,
        ...config,
        serverPort: parseInt(config.serverPort),
        mtu: parseInt(config.mtu),
        persistentKeepalive: parseInt(config.persistentKeepalive),
      }
    };

    // Save to database
    await prisma.systemConfig.update({
      where: { id: systemConfig.id },
      data: {
        vpnConfiguration: updatedVpnConfig,
      }
    });

    // Update VPNServer record
    await prisma.vPNServer.update({
      where: { id: 'wireguard' },
      data: {
        host: config.serverHost,
        port: parseInt(config.serverPort),
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
    });
  } catch (error) {
    console.error('Failed to update WireGuard configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update WireGuard configuration' },
      { status: 500 }
    );
  }
}
