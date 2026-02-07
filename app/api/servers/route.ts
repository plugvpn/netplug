import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import { execSync } from "child_process";

export async function GET() {
  try {
    // Get from VPNServer table (created during setup)
    let dbServers = await prisma.vPNServer.findMany({
      orderBy: { createdAt: 'desc' },
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
        createdAt: true,
        updatedAt: true,
      }
    });

    // Also get detailed config from SystemConfig
    const systemConfig = await prisma.systemConfig.findFirst();
    const vpnConfig = systemConfig?.vpnConfiguration as any;

    // If VPNServer table is empty but SystemConfig has data, sync it
    if (dbServers.length === 0 && vpnConfig) {
      const serversToCreate = [];

      if (vpnConfig.openVpn) {
        serversToCreate.push({
          id: 'openvpn',
          name: 'OpenVPN Server',
          protocol: 'openvpn',
          host: vpnConfig.openVpn.serverUrl,
          port: vpnConfig.openVpn.port,
          configPath: '/etc/openvpn/server.conf',
          isActive: vpnConfig.openVpn.enabled || false,
        });
      }

      if (vpnConfig.wireGuard) {
        serversToCreate.push({
          id: 'wireguard',
          name: 'WireGuard Server',
          protocol: 'wireguard',
          host: vpnConfig.wireGuard.serverHost,
          port: vpnConfig.wireGuard.serverPort,
          configPath: path.join(process.env.DATA_DIR || '/data', 'wg0.conf'),
          isActive: vpnConfig.wireGuard.enabled || false,
        });
      }

      // Create the servers in the database
      for (const serverData of serversToCreate) {
        await prisma.vPNServer.create({ data: serverData });
      }

      // Fetch again after creating
      dbServers = await prisma.vPNServer.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    // Derive public key for WireGuard servers if missing
    for (const server of dbServers) {
      if (server.protocol === 'wireguard' && server.privateKey && !server.publicKey) {
        try {
          console.log(`[WireGuard] Deriving public key for server ${server.id}...`);
          const publicKey = execSync(`echo "${server.privateKey}" | wg pubkey`, {
            encoding: 'utf-8',
            shell: '/bin/bash',
          }).trim();

          // Update the database
          await prisma.vPNServer.update({
            where: { id: server.id },
            data: { publicKey }
          });

          // Update the in-memory object
          server.publicKey = publicKey;
          console.log(`[WireGuard] Public key derived and saved for server ${server.id}`);
        } catch (error) {
          console.error(`[WireGuard] Failed to derive public key for server ${server.id}:`, error);
        }
      }
    }

    // Merge database records with detailed config
    const servers = dbServers.map(server => {
      const config = server.protocol === 'openvpn'
        ? vpnConfig?.openVpn
        : vpnConfig?.wireGuard;

      // Override configPath for WireGuard with correct DATA_DIR path
      const configPath = server.protocol === 'wireguard'
        ? path.join(process.env.DATA_DIR || '/data', 'wg0.conf')
        : server.configPath;

      return {
        ...server,
        configPath,
        config: config || {},
      };
    });

    return NextResponse.json(servers);
  } catch (error) {
    console.error('Failed to fetch servers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
}
