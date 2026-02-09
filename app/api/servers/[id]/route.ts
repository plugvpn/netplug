import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearSetupStatusCache } from "@/lib/setup";
import path from "path";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { host, port, isActive, config } = body;

    const systemConfig = await prisma.systemConfig.findFirst();

    if (!systemConfig?.vpnConfiguration) {
      return NextResponse.json(
        { error: 'VPN configuration not found' },
        { status: 404 }
      );
    }

    const vpnConfig = systemConfig.vpnConfiguration as any;

    // Update the appropriate protocol configuration
    if (id === 'openvpn') {
      if (!vpnConfig.openVpn) {
        return NextResponse.json(
          { error: 'VPN is not configured in this system' },
          { status: 404 }
        );
      }
      // Update basic fields
      if (host !== undefined) {
        vpnConfig.openVpn.serverUrl = host;
      }
      if (port !== undefined) {
        vpnConfig.openVpn.port = parseInt(port) || vpnConfig.openVpn.port;
      }

      // Update all config fields if provided
      if (config) {
        vpnConfig.openVpn = {
          ...vpnConfig.openVpn,
          ...config,
        };
      }

      // Update enabled status last to ensure it's not overwritten
      if (isActive !== undefined) {
        vpnConfig.openVpn.enabled = isActive;
      }
    } else if (id === 'wireguard') {
      if (!vpnConfig.wireGuard) {
        return NextResponse.json(
          { error: 'WireGuard is not configured in this system' },
          { status: 404 }
        );
      }
      // Update basic fields
      if (host !== undefined) {
        vpnConfig.wireGuard.serverHost = host;
      }
      if (port !== undefined) {
        vpnConfig.wireGuard.serverPort = parseInt(port) || vpnConfig.wireGuard.serverPort;
      }

      // Update all config fields if provided
      if (config) {
        vpnConfig.wireGuard = {
          ...vpnConfig.wireGuard,
          ...config,
        };
      }

      // Update enabled status last to ensure it's not overwritten
      if (isActive !== undefined) {
        vpnConfig.wireGuard.enabled = isActive;
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid server ID. Must be "openvpn" or "wireguard"' },
        { status: 400 }
      );
    }

    // Save updated configuration
    await prisma.systemConfig.update({
      where: { id: systemConfig.id },
      data: { vpnConfiguration: vpnConfig },
    });

    // Also update the VPNServer table for consistency
    try {
      if (id === 'openvpn' && vpnConfig.openVpn) {
        await prisma.vPNServer.upsert({
          where: { id: 'openvpn' },
          update: {
            host: vpnConfig.openVpn.serverUrl,
            port: vpnConfig.openVpn.port,
            isActive: vpnConfig.openVpn.enabled || false,
          },
          create: {
            id: 'openvpn',
            name: 'VPN Server',
            protocol: 'openvpn',
            host: vpnConfig.openVpn.serverUrl,
            port: vpnConfig.openVpn.port,
            configPath: '/etc/openvpn/server.conf',
            isActive: vpnConfig.openVpn.enabled || false,
          },
        });
      } else if (id === 'wireguard' && vpnConfig.wireGuard) {
        await prisma.vPNServer.upsert({
          where: { id: 'wireguard' },
          update: {
            host: vpnConfig.wireGuard.serverHost,
            port: vpnConfig.wireGuard.serverPort,
            isActive: vpnConfig.wireGuard.enabled || false,
          },
          create: {
            id: 'wireguard',
            name: 'WireGuard Server',
            protocol: 'wireguard',
            host: vpnConfig.wireGuard.serverHost,
            port: vpnConfig.wireGuard.serverPort,
            configPath: path.join(process.env.DATA_DIR || '/data', 'wg0.conf'),
            isActive: vpnConfig.wireGuard.enabled || false,
          },
        });
      }
    } catch (dbError) {
      // Ignore sync errors - SystemConfig is source of truth
    }

    // Clear the setup status cache
    clearSetupStatusCache();

    return NextResponse.json({
      success: true,
      message: "Server updated successfully",
    });
  } catch (error) {
    console.error('Failed to update server:', error);
    return NextResponse.json(
      { error: 'Failed to update server' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const systemConfig = await prisma.systemConfig.findFirst();

    if (!systemConfig?.vpnConfiguration) {
      return NextResponse.json(
        { error: 'VPN configuration not found' },
        { status: 404 }
      );
    }

    const vpnConfig = systemConfig.vpnConfiguration as any;

    // Disable the protocol instead of deleting
    if (id === 'openvpn') {
      if (!vpnConfig.openVpn) {
        return NextResponse.json(
          { error: 'VPN is not configured in this system' },
          { status: 404 }
        );
      }
      vpnConfig.openVpn.enabled = false;
    } else if (id === 'wireguard') {
      if (!vpnConfig.wireGuard) {
        return NextResponse.json(
          { error: 'WireGuard is not configured in this system' },
          { status: 404 }
        );
      }
      vpnConfig.wireGuard.enabled = false;
    } else {
      return NextResponse.json(
        { error: 'Invalid server ID. Must be "openvpn" or "wireguard"' },
        { status: 400 }
      );
    }

    // Save updated configuration
    await prisma.systemConfig.update({
      where: { id: systemConfig.id },
      data: { vpnConfiguration: vpnConfig },
    });

    // Clear the setup status cache
    clearSetupStatusCache();

    return NextResponse.json({
      success: true,
      message: "Server disabled successfully",
    });
  } catch (error) {
    console.error('Failed to disable server:', error);
    return NextResponse.json(
      { error: 'Failed to disable server' },
      { status: 500 }
    );
  }
}
