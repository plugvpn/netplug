import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNextAvailableIP, isValidIPAddress, isIpInRange } from "@/lib/utils/ip-allocation";
import { reloadWireGuardConfig } from "@/lib/wireguard/sync-service";

// Helper function to serialize BigInt values recursively
function serializeUser(user: any) {
  return JSON.parse(JSON.stringify(user, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

export async function GET() {
  try {
    const users = await prisma.vPNUser.findMany({
      include: {
        server: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users.map(serializeUser));
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, serverId, commonName, ipAddress, privateKey: providedPrivateKey, publicKey: providedPublicKey, remainingDays, remainingTrafficGB } = body;

    // Validate required fields
    if (!username || !serverId) {
      return NextResponse.json(
        { error: 'Username and server are required' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUser = await prisma.vPNUser.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }

    // Get the server to check if it's WireGuard
    const server = await prisma.vPNServer.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      );
    }

    let assignedIpAddress: string | null = ipAddress || null;

    // Validate provided IP address for WireGuard
    if (server.protocol === 'wireguard' && assignedIpAddress) {
      // Validate IP format
      if (!isValidIPAddress(assignedIpAddress)) {
        return NextResponse.json(
          { error: 'Invalid IP address format' },
          { status: 400 }
        );
      }

      // Get WireGuard configuration to validate IP is in range
      const systemConfig = await prisma.systemConfig.findFirst();
      const vpnConfig = systemConfig?.vpnConfiguration as any;

      if (vpnConfig?.wireGuard) {
        const clientAddressRange = vpnConfig.wireGuard.clientAddressRange;

        // Check if IP is within the configured range
        if (!isIpInRange(assignedIpAddress, clientAddressRange)) {
          return NextResponse.json(
            { error: `IP address must be within the configured range: ${clientAddressRange}` },
            { status: 400 }
          );
        }
      }
    }

    // Auto-assign IP for WireGuard servers if not provided
    if (server.protocol === 'wireguard' && !assignedIpAddress) {
      // Get WireGuard configuration
      const systemConfig = await prisma.systemConfig.findFirst();
      const vpnConfig = systemConfig?.vpnConfiguration as any;

      if (vpnConfig?.wireGuard) {
        const clientAddressRange = vpnConfig.wireGuard.clientAddressRange;
        const serverAddress = vpnConfig.wireGuard.serverAddress?.split('/')[0]; // Remove CIDR suffix if present

        // Get all existing IP addresses for this server
        const existingUsers = await prisma.vPNUser.findMany({
          where: {
            serverId,
            ipAddress: { not: null }
          },
          select: { ipAddress: true },
        });

        const usedIps = existingUsers
          .map(u => u.ipAddress)
          .filter((ip): ip is string => ip !== null);

        // Calculate next available IP
        assignedIpAddress = getNextAvailableIP(
          clientAddressRange,
          serverAddress || vpnConfig.wireGuard.serverAddress,
          usedIps
        );

        if (!assignedIpAddress) {
          return NextResponse.json(
            { error: 'No available IP addresses in the configured range' },
            { status: 400 }
          );
        }
      }
    }

    // Validate IP address if provided for WireGuard
    if (server.protocol === 'wireguard' && assignedIpAddress) {
      // Check if IP is already in use
      const existingUserWithIp = await prisma.vPNUser.findFirst({
        where: {
          serverId,
          ipAddress: assignedIpAddress,
        },
      });

      if (existingUserWithIp) {
        return NextResponse.json(
          { error: `IP address ${assignedIpAddress} is already in use` },
          { status: 400 }
        );
      }
    }

    // Handle WireGuard key pair for WireGuard users
    let privateKey: string | null = providedPrivateKey || null;
    let publicKey: string | null = providedPublicKey || null;

    if (server.protocol === 'wireguard') {
      // Validate that keys are provided
      if (!privateKey || !publicKey) {
        return NextResponse.json(
          { error: 'Private key and public key are required for WireGuard users' },
          { status: 400 }
        );
      }
      console.log(`[WireGuard] Using provided key pair for user: ${username}`);
    }

    // Create the user
    const user = await prisma.vPNUser.create({
      data: {
        username,
        serverId,
        commonName: commonName || null,
        ipAddress: assignedIpAddress || null,
        privateKey: privateKey,
        publicKey: publicKey,
        remainingDays: remainingDays || null,
        remainingTrafficGB: remainingTrafficGB || null,
        isEnabled: true,
      },
      include: {
        server: true,
      },
    });

    // Reload WireGuard configuration if it's a WireGuard server
    if (server.protocol === 'wireguard') {
      await reloadWireGuardConfig();
      console.log(`[WireGuard] Configuration reloaded after creating user: ${username}`);
    }

    return NextResponse.json({
      success: true,
      message: "User created successfully",
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
