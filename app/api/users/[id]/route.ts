import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reloadWireGuardConfig } from "@/lib/wireguard/sync-service";
import { requireAuth } from "@/lib/api-auth";
import { serializeVpnUserForApi } from "@/lib/vpn-user-api";
import { normalizeIpList, peerIpFromAllowedIps } from "@/lib/allowed-ips";
import { isIpInRange } from "@/lib/utils/ip-allocation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return authResult.error;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { username, serverId, commonName, allowedIps, remainingDays, remainingTrafficBytes, isEnabled } = body;

    const existing = await prisma.vPNUser.findUnique({
      where: { id },
      include: { server: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let normalizedAllowedIps: string | undefined;

    if (allowedIps !== undefined && existing.server.protocol === "wireguard") {
      const entries = normalizeIpList(typeof allowedIps === "string" ? allowedIps : "");
      if (entries.length === 0) {
        return NextResponse.json(
          { error: "Allowed IPs must include at least one CIDR entry for WireGuard users" },
          { status: 400 },
        );
      }
      for (const ip of entries) {
        if (!ip.includes("/")) {
          return NextResponse.json(
            { error: "Each allowed IP must use CIDR notation (e.g. 10.5.10.2/32)" },
            { status: 400 },
          );
        }
      }

      const systemConfig = await prisma.systemConfig.findFirst();
      const vpnConfig = systemConfig?.vpnConfiguration as { wireGuard?: { clientAddressRange?: string } } | null;
      const clientAddressRange = vpnConfig?.wireGuard?.clientAddressRange;
      const firstHost = entries[0].split("/")[0];
      if (clientAddressRange && !isIpInRange(firstHost, clientAddressRange)) {
        return NextResponse.json(
          {
            error: `Tunnel address ${firstHost} must be within the configured client range: ${clientAddressRange}`,
          },
          { status: 400 },
        );
      }

      normalizedAllowedIps = entries.join(",");
      const newPeerIp = peerIpFromAllowedIps(normalizedAllowedIps);
      if (newPeerIp) {
        const peersOnServer = await prisma.vPNUser.findMany({
          where: {
            serverId: existing.serverId,
            id: { not: id },
            allowedIps: { not: null },
          },
          select: { allowedIps: true },
        });
        for (const other of peersOnServer) {
          if (peerIpFromAllowedIps(other.allowedIps) === newPeerIp) {
            return NextResponse.json(
              { error: `Tunnel IP ${newPeerIp} is already assigned to another user on this server` },
              { status: 400 },
            );
          }
        }
      }
    }

    const user = await prisma.vPNUser.update({
      where: { id },
      data: {
        ...(username !== undefined && { username }),
        ...(serverId !== undefined && { serverId }),
        ...(commonName !== undefined && { commonName }),
        ...(normalizedAllowedIps !== undefined && { allowedIps: normalizedAllowedIps }),
        ...(remainingDays !== undefined && { remainingDays }),
        ...(remainingTrafficBytes !== undefined && { remainingTrafficBytes: remainingTrafficBytes ? BigInt(remainingTrafficBytes) : null }),
        ...(isEnabled !== undefined && { isEnabled }),
      },
      include: {
        server: true,
      },
    });

    // Sync WireGuard configuration file if it's a WireGuard server
    if (user.server.protocol === 'wireguard') {
      await reloadWireGuardConfig();
      console.log(`[WireGuard] Configuration synced after updating user: ${user.username}`);
    }

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      user: serializeVpnUserForApi(user),
    });
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return authResult.error;
  }

  try {
    const { id } = await params;

    // Get user info before deleting for logging
    const user = await prisma.vPNUser.findUnique({
      where: { id },
      include: { server: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    await prisma.vPNUser.delete({
      where: { id },
    });

    // Sync WireGuard configuration file if it's a WireGuard server
    if (user.server.protocol === 'wireguard') {
      await reloadWireGuardConfig();
      console.log(`[WireGuard] Configuration synced after deleting user: ${user.username}`);
    }

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
