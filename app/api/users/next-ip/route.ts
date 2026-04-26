import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNextAvailableIP } from "@/lib/utils/ip-allocation";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const serverId = searchParams.get('serverId');

    if (!serverId) {
      return NextResponse.json(
        { error: 'serverId is required' },
        { status: 400 }
      );
    }

    // Get the server
    const server = await prisma.vPNServer.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      );
    }

    if (server.protocol !== 'wireguard') {
      return NextResponse.json({ allowedIps: null });
    }

    // Get WireGuard configuration
    const systemConfig = await prisma.systemConfig.findFirst();
    const vpnConfig = systemConfig?.vpnConfiguration as any;

    if (!vpnConfig?.wireGuard) {
      return NextResponse.json({ allowedIps: null });
    }

    const clientAddressRange = vpnConfig.wireGuard.clientAddressRange;
    const serverAddress = vpnConfig.wireGuard.serverAddress?.split('/')[0];

    // Get all existing IP addresses for this server
    const existingUsers = await prisma.vPNUser.findMany({
      where: {
        serverId,
        allowedIps: { not: null }
      },
      select: { allowedIps: true },
    });

    const usedIps = existingUsers
      .map(u => u.allowedIps)
      .filter((ip): ip is string => ip !== null)
      .map(ips => ips.split(',')[0].split('/')[0].trim()); // Extract first IP without CIDR

    // Calculate next available IP
    const nextIp = getNextAvailableIP(
      clientAddressRange,
      serverAddress || vpnConfig.wireGuard.serverAddress,
      usedIps
    );

    return NextResponse.json({ allowedIps: nextIp ? `${nextIp}/32` : null });
  } catch (error) {
    console.error('Failed to calculate next IP:', error);
    return NextResponse.json(
      { error: 'Failed to calculate next IP' },
      { status: 500 }
    );
  }
}
