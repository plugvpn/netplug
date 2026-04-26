import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNextAvailableIP, isIpInRange } from "@/lib/utils/ip-allocation";
import { reloadWireGuardConfig } from "@/lib/wireguard/sync-service";
import { requireAuth } from "@/lib/api-auth";
import { serializeVpnUserForApi } from "@/lib/vpn-user-api";
import { normalizeIpList, peerIpFromAllowedIps } from "@/lib/allowed-ips";

export async function GET() {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return authResult.error;
  }

  try {
    const users = await prisma.vPNUser.findMany({
      include: {
        server: {
          select: {
            id: true,
            name: true,
            protocol: true,
            host: true,
            port: true,
            isActive: true,
            // Exclude private/public keys for security
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users.map(serializeVpnUserForApi));
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { username, serverId, commonName, allowedIps, privateKey: providedPrivateKey, publicKey: providedPublicKey, presharedKey: providedPresharedKey, remainingDays, remainingTrafficBytes } = body;

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

    let assignedAllowedIps: string | null = allowedIps || null;

    // Auto-assign IP for WireGuard servers if not provided
    if (server.protocol === 'wireguard' && !assignedAllowedIps) {
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

        if (!nextIp) {
          return NextResponse.json(
            { error: 'No available IP addresses in the configured range' },
            { status: 400 }
          );
        }
        
        // Assign with /32 suffix for single IP
        assignedAllowedIps = `${nextIp}/32`;
      }
    }

    // WireGuard: CIDR format for all entries; only the tunnel (first) address must sit in clientAddressRange.
    // Additional AllowedIPs may be any routable prefixes (e.g. 192.168.0.0/16, 0.0.0.0/0).
    if (server.protocol === 'wireguard' && assignedAllowedIps) {
      const entries = normalizeIpList(assignedAllowedIps);
      if (entries.length === 0) {
        return NextResponse.json(
          { error: 'Allowed IPs must include at least one CIDR entry' },
          { status: 400 }
        );
      }
      for (const ip of entries) {
        if (!ip.includes('/')) {
          return NextResponse.json(
            { error: 'IPs must be in CIDR notation (e.g., 10.5.10.2/32)' },
            { status: 400 }
          );
        }
      }

      const systemConfig = await prisma.systemConfig.findFirst();
      const vpnConfig = systemConfig?.vpnConfiguration as { wireGuard?: { clientAddressRange?: string } } | null;
      const clientAddressRange = vpnConfig?.wireGuard?.clientAddressRange;
      if (clientAddressRange) {
        const firstHost = entries[0].split('/')[0];
        if (!isIpInRange(firstHost, clientAddressRange)) {
          return NextResponse.json(
            {
              error: `Tunnel address ${firstHost} must be within the configured client range: ${clientAddressRange}`,
            },
            { status: 400 }
          );
        }
      }

      assignedAllowedIps = entries.join(',');

      const newPeerIp = peerIpFromAllowedIps(assignedAllowedIps);
      if (newPeerIp) {
        const peersOnServer = await prisma.vPNUser.findMany({
          where: { serverId, allowedIps: { not: null } },
          select: { allowedIps: true, username: true },
        });
        for (const other of peersOnServer) {
          if (peerIpFromAllowedIps(other.allowedIps) === newPeerIp) {
            return NextResponse.json(
              {
                error: `Tunnel IP ${newPeerIp} is already assigned to user ${other.username}`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // Handle WireGuard key pair for WireGuard users
    let privateKey: string | null = providedPrivateKey || null;
    let publicKey: string | null = providedPublicKey || null;
    let presharedKey: string | null = providedPresharedKey || null;

    if (server.protocol === 'wireguard') {
      // Validate that keys are provided
      if (!privateKey || !publicKey) {
        return NextResponse.json(
          { error: 'Private key and public key are required for WireGuard users' },
          { status: 400 }
        );
      }
      console.log(`[WireGuard] Using provided key pair for user: ${username}`);
      if (presharedKey) {
        console.log(`[WireGuard] Using preshared key for enhanced security: ${username}`);
      }
    }

    // Create the user
    const user = await prisma.vPNUser.create({
      data: {
        username,
        serverId,
        commonName: commonName || null,
        allowedIps: assignedAllowedIps || null,
        privateKey: privateKey,
        publicKey: publicKey,
        presharedKey: presharedKey,
        remainingDays: remainingDays || null,
        remainingTrafficBytes: remainingTrafficBytes ? BigInt(remainingTrafficBytes) : null,
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
      user: serializeVpnUserForApi(user),
    });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
