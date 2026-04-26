import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { peerIpFromAllowedIps } from "@/lib/allowed-ips";

// Helper function to get client IP from request headers
function getClientIP(headersList: Headers): string | null {
  // Check various headers that might contain the real IP
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, use the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = headersList.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Cloudflare specific header
  const cfConnectingIP = headersList.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return null;
}

export async function GET() {
  try {
    // Always get client IP from request headers
    const headersList = await headers();
    const ipAddress = getClientIP(headersList);

    console.log(`[VPN Status] Auto-detected IP from request: ${ipAddress || 'NONE'}`);

    if (!ipAddress) {
      console.log('[VPN Status] Failed to determine client IP address');
      return NextResponse.json(
        { error: 'Could not determine IP address' },
        { status: 400 }
      );
    }

    // Find VPN user by IP address (check if IP is in allowedIps list)
    const user = await prisma.vPNUser.findFirst({
      where: {
        allowedIps: {
          contains: ipAddress,
        },
      },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            protocol: true,
            host: true,
            port: true,
            isActive: true,
            // Exclude server's private/public keys
          },
        },
      },
    });

    if (!user) {
      console.log(`[VPN Status] No user found for IP: ${ipAddress}`);
      return NextResponse.json(
        { error: 'No VPN user found with this IP address' },
        { status: 404 }
      );
    }

    console.log(`[VPN Status] User found: ${user.username} (IP: ${ipAddress})`);

    // Create sanitized user object without sensitive keys
    const sanitizedUser = {
      id: user.id,
      username: user.username,
      allowedIps: user.allowedIps,
      ipAddress: peerIpFromAllowedIps(user.allowedIps),
      endpoint: user.endpoint, // Real public IP they're connecting from
      remainingDays: user.remainingDays,
      remainingTrafficBytes: user.remainingTrafficBytes?.toString(),
      totalBytesReceived: user.totalBytesReceived.toString(),
      totalBytesSent: user.totalBytesSent.toString(),
      isConnected: user.isConnected,
      connectedAt: user.connectedAt,
      server: user.server,
      // Explicitly exclude: privateKey, publicKey, presharedKey
    };

    return NextResponse.json({
      success: true,
      user: sanitizedUser,
      detectedIP: ipAddress,
    });
  } catch (error) {
    console.error('Failed to fetch user by IP:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user by IP' },
      { status: 500 }
    );
  }
}
