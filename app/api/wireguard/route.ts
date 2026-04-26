import { NextRequest, NextResponse } from "next/server";
import os from "os";
import { prisma } from "@/lib/prisma";
import { getPrimarySystemConfig } from "@/lib/setup";
import path from "path";
import { requireAuth } from "@/lib/api-auth";
import { wgPubkeyFromPrivate } from "@/lib/wireguard/wg-pubkey";
import { writeWireGuardConfig } from "@/lib/wireguard/config-generator";
import {
  applyWireGuardConfigToRunningInterface,
  getWireGuardStatus,
  getWireGuardTunnelUptimeSeconds,
} from "@/lib/wireguard/sync-service";

function normalizeWireGuardForApi(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Record<string, unknown>;
  const port = parseInt(String(w.serverPort ?? "51820"), 10);
  const mtu = parseInt(String(w.mtu ?? "1420"), 10);
  const ka = parseInt(String(w.persistentKeepalive ?? "25"), 10);
  const out: Record<string, unknown> = {
    enabled: w.enabled !== false,
    configSource: w.configSource === "uploaded" ? "uploaded" : "wizard",
    serverHost: String(w.serverHost ?? ""),
    serverPort:
      !isNaN(port) && port >= 1 && port <= 65535 ? port : 51820,
    serverAddress: String(w.serverAddress ?? ""),
    clientAddressRange: String(w.clientAddressRange ?? ""),
    dns: String(w.dns ?? "1.1.1.1, 1.0.0.1"),
    mtu: !isNaN(mtu) && mtu > 0 ? mtu : 1420,
    persistentKeepalive: !isNaN(ka) && ka >= 0 ? ka : 25,
    allowedIps: String(w.allowedIps ?? "0.0.0.0/0, ::/0"),
    preUp: typeof w.preUp === "string" ? w.preUp : "",
    preDown: typeof w.preDown === "string" ? w.preDown : "",
    postUp: typeof w.postUp === "string" ? w.postUp : "",
    postDown: typeof w.postDown === "string" ? w.postDown : "",
  };
  const fw = w.fwMark;
  if (typeof fw === "number" && !isNaN(fw)) {
    out.fwMark = fw;
  }
  return out;
}

function parsePort(v: unknown, fallback: number) {
  const n = parseInt(String(v ?? ""), 10);
  return !isNaN(n) && n >= 1 && n <= 65535 ? n : fallback;
}

function parsePositiveInt(v: unknown, fallback: number) {
  const n = parseInt(String(v ?? ""), 10);
  return !isNaN(n) && n > 0 ? n : fallback;
}

function parseNonNegativeInt(v: unknown, fallback: number) {
  const n = parseInt(String(v ?? ""), 10);
  return !isNaN(n) && n >= 0 ? n : fallback;
}

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return authResult.error;
  }

  try {
    const systemConfig = await getPrimarySystemConfig();
    const vpnConfig = systemConfig?.vpnConfiguration as any;

    if (!vpnConfig?.wireGuard) {
      return NextResponse.json(
        { error: "WireGuard configuration not found" },
        { status: 404 }
      );
    }

    let server = await prisma.vPNServer.findUnique({
      where: { id: "wireguard" },
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
      },
    });

    if (server?.privateKey && !server.publicKey) {
      try {
        console.log("[WireGuard] Deriving public key from private key...");
        const publicKey = await wgPubkeyFromPrivate(server.privateKey);
        await prisma.vPNServer.update({
          where: { id: "wireguard" },
          data: { publicKey },
        });
        server = { ...server, publicKey };
        console.log("[WireGuard] Public key derived and saved successfully");
      } catch (error) {
        console.error("[WireGuard] Failed to derive public key:", error);
      }
    }

    const serverWithCorrectPath = server
      ? {
          ...server,
          configPath: path.join(process.env.DATA_DIR || "/data", "wg0.conf"),
        }
      : null;

    const serverResponse = serverWithCorrectPath
      ? { ...serverWithCorrectPath }
      : ({} as Record<string, unknown>);

    const config = normalizeWireGuardForApi(vpnConfig.wireGuard);
    if (!config) {
      return NextResponse.json(
        { error: "WireGuard configuration is invalid" },
        { status: 500 }
      );
    }

    const wgLive = await getWireGuardStatus("wg0");
    const live = wgLive
      ? {
          up: true,
          interfaceName: wgLive.interface,
          listenPort: wgLive.listenPort,
        }
      : { up: false as const };

    const hostUptimeSeconds = Math.floor(os.uptime());
    const tunnelUptimeSeconds =
      wgLive != null
        ? await getWireGuardTunnelUptimeSeconds(wgLive.interface)
        : null;

    return NextResponse.json({
      config,
      server: serverResponse,
      live,
      hostUptimeSeconds,
      tunnelUptimeSeconds,
    });
  } catch (error) {
    console.error("Failed to fetch WireGuard configuration:", error);
    return NextResponse.json(
      { error: "Failed to fetch WireGuard configuration" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { config, serverPrivateKey } = body as {
      config: {
        serverHost?: unknown;
        serverPort?: unknown;
        mtu?: unknown;
        persistentKeepalive?: unknown;
        [key: string]: unknown;
      };
      serverPrivateKey?: string;
    };

    const systemConfig = await getPrimarySystemConfig();

    if (!systemConfig) {
      return NextResponse.json(
        { error: "System configuration not found" },
        { status: 404 }
      );
    }

    const vpnConfig = systemConfig.vpnConfiguration as any;
    const prev = (vpnConfig?.wireGuard ?? {}) as Record<string, unknown>;

    const serverPort = parsePort(
      config.serverPort,
      parsePort(prev.serverPort, 51820)
    );
    const mtu = parsePositiveInt(config.mtu, parsePositiveInt(prev.mtu, 1420));
    const persistentKeepalive = parseNonNegativeInt(
      config.persistentKeepalive,
      parseNonNegativeInt(prev.persistentKeepalive, 25)
    );

    const configSource =
      prev.configSource === "uploaded" ? "uploaded" : "wizard";

    const updatedVpnConfig = {
      ...vpnConfig,
      wireGuard: {
        ...prev,
        ...config,
        configSource,
        serverPort,
        mtu,
        persistentKeepalive,
      },
    };

    await prisma.systemConfig.update({
      where: { id: systemConfig.id },
      data: {
        vpnConfiguration: updatedVpnConfig,
      },
    });

    if (typeof serverPrivateKey === "string") {
      const trimmed = serverPrivateKey.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "Server private key cannot be empty." },
          { status: 400 },
        );
      }
      const current = await prisma.vPNServer.findUnique({
        where: { id: "wireguard" },
        select: { privateKey: true },
      });
      if (trimmed !== (current?.privateKey ?? "")) {
        try {
          const publicKey = await wgPubkeyFromPrivate(trimmed);
          await prisma.vPNServer.update({
            where: { id: "wireguard" },
            data: { privateKey: trimmed, publicKey },
          });
        } catch {
          return NextResponse.json(
            {
              error:
                "Invalid WireGuard private key. It must be a valid key for wg/wg-quick.",
            },
            { status: 400 },
          );
        }
      }
    }

    await prisma.vPNServer.update({
      where: { id: "wireguard" },
      data: {
        host: String(config.serverHost ?? ""),
        port: serverPort,
      },
    });

    const wgEnabled = updatedVpnConfig.wireGuard?.enabled !== false;
    let wireGuardReloaded: boolean | null = null;
    let wireGuardWriteOk: boolean | null = null;
    if (wgEnabled) {
      wireGuardWriteOk = await writeWireGuardConfig();
      wireGuardReloaded = wireGuardWriteOk
        ? await applyWireGuardConfigToRunningInterface("wg0")
        : false;
    }

    return NextResponse.json({
      success: true,
      message:
        wireGuardWriteOk === false
          ? "Configuration saved, but updating wg0.conf on disk failed. Check DATA_DIR and server logs."
          : wireGuardReloaded === false
            ? "Configuration saved and wg0.conf updated, but applying live WireGuard settings failed. Check server logs."
            : wireGuardReloaded === true
              ? "Configuration updated, wg0.conf written, and WireGuard reloaded."
              : "Configuration updated successfully.",
      wireGuardReloaded,
      wireGuardWriteOk,
    });
  } catch (error) {
    console.error("Failed to update WireGuard configuration:", error);
    return NextResponse.json(
      { error: "Failed to update WireGuard configuration" },
      { status: 500 }
    );
  }
}
