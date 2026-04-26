import { prisma } from "@/lib/prisma";
import { getPrimarySystemConfig } from "@/lib/setup";
import fs from "fs/promises";
import path from "path";

export async function isWireGuardConfigUploaded(): Promise<boolean> {
  const systemConfig = await getPrimarySystemConfig();
  const wg = (systemConfig?.vpnConfiguration as any)?.wireGuard;
  return wg?.configSource === "uploaded";
}

interface WireGuardConfig {
  enabled: boolean;
  serverHost: string;
  serverPort: number;
  serverAddress: string;
  clientAddressRange: string;
  dns: string;
  mtu: number;
  persistentKeepalive: number;
  allowedIps: string;
  postUp?: string;
  postDown?: string;
}

/**
 * Generate WireGuard server configuration file (wg0.conf)
 */
export async function generateWireGuardConfig(): Promise<string | null> {
  try {
    // Get WireGuard configuration from SystemConfig
    const systemConfig = await getPrimarySystemConfig();
    const vpnConfig = systemConfig?.vpnConfiguration as any;

    if (vpnConfig?.wireGuard?.configSource === "uploaded") {
      const dataDir = process.env.DATA_DIR;
      if (!dataDir) return null;
      const configPath = path.join(dataDir, "wg0.conf");
      try {
        return await fs.readFile(configPath, "utf-8");
      } catch {
        console.warn(
          "[WireGuard] Uploaded config mode but wg0.conf is missing on disk"
        );
        return null;
      }
    }

    if (!vpnConfig?.wireGuard) {
      console.warn('WireGuard configuration not found in database');
      return null;
    }

    const wgConfig: WireGuardConfig = vpnConfig.wireGuard;

    // Get WireGuard server
    const server = await prisma.vPNServer.findUnique({
      where: { id: 'wireguard' }
    });

    if (!server) {
      console.warn('WireGuard server not found in database');
      return null;
    }

    // Get all enabled users for WireGuard server
    const users = await prisma.vPNUser.findMany({
      where: {
        serverId: server.id,
        isEnabled: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Ensure server address has CIDR notation
    let serverAddress = wgConfig.serverAddress;
    if (!serverAddress.includes('/')) {
      // Extract CIDR from clientAddressRange (e.g., "10.8.0.0/24" -> "/24")
      const cidr = wgConfig.clientAddressRange.includes('/')
        ? wgConfig.clientAddressRange.substring(wgConfig.clientAddressRange.indexOf('/'))
        : '/24'; // default fallback
      serverAddress = `${serverAddress}${cidr}`;
    }

    // Generate configuration content
    let config = `# WireGuard Server Configuration
# Generated at: ${new Date().toISOString()}
# DO NOT EDIT MANUALLY - This file is auto-generated

[Interface]
Address = ${serverAddress}
ListenPort = ${wgConfig.serverPort}
`;

    // Add PostUp/PostDown if configured
    if (wgConfig.postUp) {
      config += `PostUp = ${wgConfig.postUp}\n`;
    }
    if (wgConfig.postDown) {
      config += `PostDown = ${wgConfig.postDown}\n`;
    }

    // Add server private key
    if (server.privateKey) {
      config += `PrivateKey = ${server.privateKey}\n`;
    } else {
      config += `# ERROR: Server private key not found!\n`;
      config += `PrivateKey = <SERVER_PRIVATE_KEY_NOT_GENERATED>\n`;
      console.error('[WireGuard] Server private key not found in database');
    }

    config += `\n# MTU Configuration\n`;
    config += `MTU = ${wgConfig.mtu}\n`;

    // Add peer configurations for each user
    if (users.length > 0) {
      config += `\n# ========== Client Peers ==========\n`;

      for (const user of users) {
        if (!user.allowedIps) {
          console.warn(`User ${user.username} has no allowed IPs assigned, skipping`);
          continue;
        }

        config += `\n# User: ${user.username}\n`;
        config += `[Peer]\n`;

        if (user.publicKey) {
          config += `PublicKey = ${user.publicKey}\n`;
        } else {
          config += `# ERROR: Public key not found for user ${user.username}!\n`;
          config += `PublicKey = <PUBLIC_KEY_FOR_${user.username.toUpperCase()}_NOT_GENERATED>\n`;
          console.error(`[WireGuard] Public key not found for user: ${user.username}`);
        }

        // Add preshared key if configured
        if (user.presharedKey) {
          config += `PresharedKey = ${user.presharedKey}\n`;
        }

        config += `AllowedIPs = ${user.allowedIps}\n`;

        if (wgConfig.persistentKeepalive > 0) {
          config += `PersistentKeepalive = ${wgConfig.persistentKeepalive}\n`;
        }
      }
    } else {
      config += `\n# No active users configured yet\n`;
    }

    return config;
  } catch (error) {
    console.error('Failed to generate WireGuard configuration:', error);
    return null;
  }
}

/**
 * Write WireGuard configuration to file
 */
export async function writeWireGuardConfig(): Promise<boolean> {
  try {
    const dataDir = process.env.DATA_DIR;
    if (!dataDir) {
      console.error('DATA_DIR environment variable is not set');
      return false;
    }

    await fs.mkdir(dataDir, { recursive: true });

    const configPath = path.join(dataDir, 'wg0.conf');

    if (await isWireGuardConfigUploaded()) {
      try {
        await fs.access(configPath);
        console.log(
          `[WireGuard] Preserving uploaded wg0.conf (not regenerating): ${configPath}`
        );
        return true;
      } catch {
        console.error(
          '[WireGuard] Uploaded config mode but wg0.conf is missing; cannot reload'
        );
        return false;
      }
    }

    const config = await generateWireGuardConfig();
    if (!config) {
      console.error('Failed to generate WireGuard configuration');
      return false;
    }

    // Write configuration file
    await fs.writeFile(configPath, config, 'utf-8');

    // Set proper permissions: 600 (read/write for owner only)
    // This is critical for security as the file contains private keys
    await fs.chmod(configPath, 0o600);

    console.log(`WireGuard configuration written to: ${configPath}`);
    console.log(`File permissions set to 600 (owner read/write only)`);
    return true;
  } catch (error) {
    console.error('Failed to write WireGuard configuration:', error);
    return false;
  }
}

/**
 * Generate client configuration for a specific user
 */
export async function generateClientConfig(userId: string): Promise<string | null> {
  try {
    // Get user
    const user = await prisma.vPNUser.findUnique({
      where: { id: userId },
      include: { server: true },
    });

    if (!user || user.server.protocol !== 'wireguard') {
      return null;
    }

    // Get WireGuard configuration
    const systemConfig = await getPrimarySystemConfig();
    const vpnConfig = systemConfig?.vpnConfiguration as any;

    if (!vpnConfig?.wireGuard) {
      return null;
    }

    const wgConfig: WireGuardConfig = vpnConfig.wireGuard;

    // Get server public key
    const server = await prisma.vPNServer.findUnique({
      where: { id: 'wireguard' }
    });

    // Generate client configuration
    let config = `# WireGuard Client Configuration
# User: ${user.username}
# Generated at: ${new Date().toISOString()}

[Interface]
`;

    if (user.privateKey) {
      config += `PrivateKey = ${user.privateKey}\n`;
    } else {
      config += `# ERROR: Private key not found!\n`;
      config += `PrivateKey = <CLIENT_PRIVATE_KEY_NOT_GENERATED>\n`;
    }

    config += `Address = ${user.allowedIps?.split(',')[0] || ''}
DNS = ${wgConfig.dns}
MTU = ${wgConfig.mtu}

[Peer]
`;

    if (server?.publicKey) {
      config += `PublicKey = ${server.publicKey}\n`;
    } else {
      config += `# ERROR: Server public key not found!\n`;
      config += `PublicKey = <SERVER_PUBLIC_KEY_NOT_FOUND>\n`;
    }

    // Add preshared key if configured for this user
    if (user.presharedKey) {
      config += `PresharedKey = ${user.presharedKey}\n`;
    }

    config += `Endpoint = ${wgConfig.serverHost}:${wgConfig.serverPort}
AllowedIPs = ${wgConfig.allowedIps}
PersistentKeepalive = ${wgConfig.persistentKeepalive}
`;

    return config;
  } catch (error) {
    console.error('Failed to generate client configuration:', error);
    return null;
  }
}
