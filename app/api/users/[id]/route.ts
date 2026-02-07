import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reloadWireGuardConfig } from "@/lib/wireguard/sync-service";

// Helper function to serialize BigInt values recursively
function serializeUser(user: any) {
  return JSON.parse(JSON.stringify(user, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { username, serverId, commonName, remainingDays, remainingTrafficGB, isEnabled } = body;

    const user = await prisma.vPNUser.update({
      where: { id },
      data: {
        ...(username !== undefined && { username }),
        ...(serverId !== undefined && { serverId }),
        ...(commonName !== undefined && { commonName }),
        ...(remainingDays !== undefined && { remainingDays }),
        ...(remainingTrafficGB !== undefined && { remainingTrafficGB }),
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
      user: serializeUser(user),
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
