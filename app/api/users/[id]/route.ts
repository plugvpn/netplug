import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reloadWireGuardConfig } from "@/lib/wireguard/sync-service";
import { requireAuth } from "@/lib/api-auth";
import { serializeVpnUserForApi } from "@/lib/vpn-user-api";
import { normalizeIpList, peerIpFromAllowedIps } from "@/lib/allowed-ips";
import { isIpInRange } from "@/lib/utils/ip-allocation";
import { wgPubkeyFromPrivate } from "@/lib/wireguard/wg-pubkey";
import { normalizePeerIconForApi } from "@/lib/peer-icons";

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
    const {
      username,
      serverId,
      commonName,
      allowedIps,
      remainingDays,
      remainingTrafficBytes,
      isEnabled,
      privateKey: bodyPrivateKey,
      peerIcon: bodyPeerIcon,
    } = body;

    const existing = await prisma.vPNUser.findUnique({
      where: { id },
      include: { server: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let normalizedUsername: string | undefined;
    if (username !== undefined) {
      const next = String(username).trim();
      if (!next) {
        return NextResponse.json(
          { error: "Username cannot be empty" },
          { status: 400 },
        );
      }
      if (next !== existing.username) {
        const taken = await prisma.vPNUser.findUnique({
          where: { username: next },
        });
        if (taken) {
          return NextResponse.json(
            { error: "Username already exists" },
            { status: 400 },
          );
        }
      }
      normalizedUsername = next;
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

    let privateKeyUpdate: { privateKey: string; publicKey: string } | null = null;
    if (existing.server.protocol === "wireguard" && bodyPrivateKey !== undefined) {
      const trimmed =
        typeof bodyPrivateKey === "string" ? bodyPrivateKey.trim() : "";
      const hadPrivate = Boolean(
        existing.privateKey && existing.privateKey.trim().length > 0,
      );
      if (trimmed) {
        if (hadPrivate) {
          if (trimmed === existing.privateKey!.trim()) {
            // No-op: client resent the existing key on save
          } else {
            return NextResponse.json(
              {
                error:
                  "Private key is already set for this user and cannot be changed.",
              },
              { status: 400 },
            );
          }
        } else {
          try {
            const derivedPublic = await wgPubkeyFromPrivate(trimmed);
            const existingPub = existing.publicKey?.trim() ?? "";
            if (existingPub && derivedPublic !== existingPub) {
              return NextResponse.json(
                {
                  error:
                    "Private key does not match this user's stored public key. Use the key pair for this peer.",
                },
                { status: 400 },
              );
            }
            privateKeyUpdate = {
              privateKey: trimmed,
              publicKey: derivedPublic,
            };
          } catch {
            return NextResponse.json(
              { error: "Invalid WireGuard private key." },
              { status: 400 },
            );
          }
        }
      }
    }

    const peerIconPatch =
      bodyPeerIcon !== undefined
        ? { peerIcon: normalizePeerIconForApi(bodyPeerIcon) }
        : {};

    if (serverId !== undefined) {
      const nextServerId = String(serverId);
      if (nextServerId !== existing.serverId) {
        const serverRecord = await prisma.vPNServer.findUnique({
          where: { id: nextServerId },
        });
        if (!serverRecord) {
          return NextResponse.json(
            { error: "Server not found" },
            { status: 404 },
          );
        }
      }
    }

    const user = await prisma.vPNUser.update({
      where: { id },
      data: {
        ...(normalizedUsername !== undefined && { username: normalizedUsername }),
        ...(serverId !== undefined && {
          server: { connect: { id: String(serverId) } },
        }),
        ...(commonName !== undefined && { commonName }),
        ...(normalizedAllowedIps !== undefined && { allowedIps: normalizedAllowedIps }),
        ...(remainingDays !== undefined && { remainingDays }),
        ...(remainingTrafficBytes !== undefined && { remainingTrafficBytes: remainingTrafficBytes ? BigInt(remainingTrafficBytes) : null }),
        ...(isEnabled !== undefined && { isEnabled }),
        ...(privateKeyUpdate ?? {}),
        ...peerIconPatch,
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
    console.error("Failed to update user:", error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
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
