import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from '@/lib/prisma';
import { writeWireGuardConfig } from './config-generator';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Get the actual interface name for a WireGuard config
 * On macOS, wg0 might actually be utun8 or similar
 * On Linux, wg0 will typically be wg0
 */
async function getActualInterfaceName(configName = 'wg0'): Promise<string | null> {
  try {
    // First, try to list all WireGuard interfaces
    const { stdout } = await execAsync('wg show interfaces');
    const interfaces = stdout.trim().split(/\s+/).filter(i => i);

    if (interfaces.length === 0) {
      console.warn(`[WireGuard] No WireGuard interfaces found. Is WireGuard running?`);
      return null;
    }

    // On macOS, the interface might be utunX
    // Try to find any interface that matches our config
    for (const iface of interfaces) {
      try {
        // Check if this interface has configuration
        const { stdout: showOutput } = await execAsync(`wg show ${iface}`);
        if (showOutput) {
          if (iface !== configName) {
            console.log(`[WireGuard] Config '${configName}' maps to interface '${iface}'`);
          }
          return iface;
        }
      } catch (error: any) {
        console.warn(`[WireGuard] Cannot access interface '${iface}': ${error.message}`);
        continue;
      }
    }

    // If we have any interface, return the first one
    const firstInterface = interfaces[0];
    if (firstInterface !== configName) {
      console.log(`[WireGuard] Using interface '${firstInterface}' for config '${configName}'`);
    }
    return firstInterface;
  } catch (error: any) {
    if (error.stderr?.includes('Operation not permitted') || error.stderr?.includes('Permission denied')) {
      console.error(`[WireGuard] Permission denied - WireGuard commands require root/sudo access`);
    } else {
      console.error(`[WireGuard] Failed to list interfaces: ${error.message}`);
    }

    // If wg show interfaces fails, try checking if the config name exists directly
    try {
      await execAsync(`wg show ${configName}`);
      return configName;
    } catch {
      return null;
    }
  }
}

interface WireGuardPeerStatus {
  publicKey: string;
  presharedKey: string;
  endpoint: string;
  allowedIps: string;
  latestHandshake: number;
  transferRx: bigint;
  transferTx: bigint;
  persistentKeepalive: number;
}

interface WireGuardStatus {
  interface: string;
  publicKey: string;
  privateKey: string;
  listenPort: number;
  peers: WireGuardPeerStatus[];
}

/**
 * Parse WireGuard dump output
 * Format: interface, public-key, private-key, listen-port, fwmark
 * Peer format: public-key, preshared-key, endpoint, allowed-ips, latest-handshake, transfer-rx, transfer-tx, persistent-keepalive
 */
function parseWireGuardDump(output: string): WireGuardStatus | null {
  try {
    const lines = output.trim().split('\n');
    if (lines.length === 0) return null;

    const [interfaceLine, ...peerLines] = lines;
    const [iface, publicKey, privateKey, listenPort] = interfaceLine.split('\t');

    const status: WireGuardStatus = {
      interface: iface,
      publicKey,
      privateKey,
      listenPort: parseInt(listenPort, 10),
      peers: [],
    };

    // Parse each peer
    for (const line of peerLines) {
      if (!line.trim()) continue;

      const [
        peerPublicKey,
        presharedKey,
        endpoint,
        allowedIps,
        latestHandshake,
        transferRx,
        transferTx,
        persistentKeepalive,
      ] = line.split('\t');

      status.peers.push({
        publicKey: peerPublicKey,
        presharedKey: presharedKey === '(none)' ? '' : presharedKey,
        endpoint: endpoint === '(none)' ? '' : endpoint,
        allowedIps,
        latestHandshake: parseInt(latestHandshake, 10),
        transferRx: BigInt(transferRx),
        transferTx: BigInt(transferTx),
        persistentKeepalive: parseInt(persistentKeepalive, 10),
      });
    }

    return status;
  } catch (error) {
    console.error('Failed to parse WireGuard dump:', error);
    return null;
  }
}

/**
 * Get WireGuard interface status using `wg show dump`
 */
export async function getWireGuardStatus(interfaceName = 'wg0'): Promise<WireGuardStatus | null> {
  try {
    // Get the actual interface name (might be utun8 on macOS instead of wg0)
    const actualInterface = await getActualInterfaceName(interfaceName);
    if (!actualInterface) {
      console.warn(`[WireGuard] No interface found for config '${interfaceName}'`);
      return null;
    }

    const { stdout } = await execAsync(`wg show ${actualInterface} dump`);
    return parseWireGuardDump(stdout);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error('[WireGuard] WireGuard tools not installed or not in PATH');
    } else if (error.stderr?.includes('Unable to access interface')) {
      console.warn(`[WireGuard] Unable to access interface '${interfaceName}' - may need elevated permissions`);
    } else if (error.stderr?.includes('Operation not permitted')) {
      console.warn(`[WireGuard] Permission denied accessing interface - run with sudo or elevated privileges`);
    } else {
      console.error(`[WireGuard] Failed to get status for '${interfaceName}':`, error.message);
      if (error.stderr) {
        console.error(`[WireGuard] Error details:`, error.stderr);
      }
    }
    return null;
  }
}

/**
 * Bring up WireGuard interface using wg-quick
 */
export async function bringUpWireGuard(interfaceName = 'wg0'): Promise<boolean> {
  try {
    const dataDir = process.env.DATA_DIR;
    if (!dataDir) {
      console.error('DATA_DIR environment variable is not set');
      return false;
    }

    const configPath = path.join(dataDir, 'wg0.conf');

    // Check if interface already exists (might be utunX on macOS)
    const actualInterface = await getActualInterfaceName(interfaceName);
    if (actualInterface) {
      console.log(`Interface ${interfaceName} already exists as ${actualInterface}, using syncconf for live reload`);
      return await syncWireGuardConfigLive(interfaceName);
    }

    // Interface doesn't exist, bring it up with wg-quick
    console.log(`Bringing up WireGuard interface with wg-quick: ${configPath}`);
    const { stdout, stderr } = await execAsync(`wg-quick up ${configPath}`);

    // Parse output to find actual interface name (especially on macOS)
    const interfaceMatch = stdout.match(/Interface for \S+ is (\S+)/) || stderr.match(/Interface for \S+ is (\S+)/);
    if (interfaceMatch) {
      console.log(`WireGuard interface created: ${interfaceMatch[1]}`);
    }

    console.log(`WireGuard interface ${interfaceName} brought up successfully`);
    return true;
  } catch (error: any) {
    // Check if it's already running
    if (error.message.includes('already exists')) {
      console.log(`Interface ${interfaceName} is already running`);
      return true;
    }
    console.error('Failed to bring up WireGuard interface:', error.message);
    return false;
  }
}

/**
 * Bring down WireGuard interface using wg-quick
 */
export async function bringDownWireGuard(interfaceName = 'wg0'): Promise<boolean> {
  try {
    const dataDir = process.env.DATA_DIR;
    if (!dataDir) {
      console.error('DATA_DIR environment variable is not set');
      return false;
    }

    const configPath = path.join(dataDir, 'wg0.conf');

    console.log(`Bringing down WireGuard interface: ${interfaceName}`);
    await execAsync(`wg-quick down ${configPath}`);
    console.log(`WireGuard interface ${interfaceName} brought down successfully`);
    return true;
  } catch (error: any) {
    if (error.message.includes('is not a WireGuard interface')) {
      console.log(`Interface ${interfaceName} doesn't exist or is already down`);
      return true;
    }
    console.error('Failed to bring down WireGuard interface:', error.message);
    return false;
  }
}

/**
 * Sync WireGuard configuration without disconnecting clients
 * Uses wg syncconf for live reloading
 */
export async function syncWireGuardConfigLive(interfaceName = 'wg0'): Promise<boolean> {
  try {
    const dataDir = process.env.DATA_DIR;
    if (!dataDir) {
      console.error('DATA_DIR environment variable is not set');
      return false;
    }

    const configPath = path.join(dataDir, 'wg0.conf');

    // Get the actual interface name (might be utunX on macOS)
    const actualInterface = await getActualInterfaceName(interfaceName);
    if (!actualInterface) {
      console.error(`Cannot find actual interface for ${interfaceName}`);
      return false;
    }

    console.log(`Syncing WireGuard configuration (live reload): ${actualInterface}`);

    // Use wg syncconf with wg-quick strip to apply config without disconnecting clients
    // This removes the [Interface] section and keeps only [Peer] sections
    await execAsync(`wg syncconf ${actualInterface} <(wg-quick strip ${configPath})`, {
      shell: '/bin/bash', // Required for process substitution <()
    });

    console.log(`WireGuard configuration synced successfully`);
    return true;
  } catch (error: any) {
    console.error('Failed to sync WireGuard configuration:', error.message);
    // If syncconf fails, fall back to full restart
    console.log('Falling back to full interface restart...');
    await bringDownWireGuard(interfaceName);
    return await bringUpWireGuard(interfaceName);
  }
}

/**
 * Sync WireGuard peer status to database
 * Updates connection status and data transfer for each user
 * Uses persistent_keepalive to determine if user is online/offline
 */
export async function syncWireGuardStatus(interfaceName = 'wg0'): Promise<void> {
  try {
    // Get the actual interface name
    const actualInterface = await getActualInterfaceName(interfaceName);
    if (!actualInterface) {
      console.warn(`[WireGuard] Interface ${interfaceName} not found, skipping sync`);
      return;
    }

    const status = await getWireGuardStatus(interfaceName);
    if (!status) {
      console.warn('[WireGuard] Unable to get status, skipping sync');
      return;
    }

    // User is considered offline if handshake is older than 2 minutes (120 seconds)
    const timeoutSeconds = 120;

    console.log(`[WireGuard] Using timeout: ${timeoutSeconds}s (2 minutes)`);

    // Get all VPN users for WireGuard
    const users = await prisma.vPNUser.findMany({
      where: {
        server: {
          protocol: 'wireguard',
        },
      },
    });

    // Create a map of publicKey -> peer status
    const peerMap = new Map(status.peers.map(peer => [peer.publicKey, peer]));

    const now = Math.floor(Date.now() / 1000);
    let connectedCount = 0;
    let disconnectedCount = 0;

    // Update each user's connection status
    for (const user of users) {
      if (!user.publicKey) {
        console.warn(`[WireGuard] User ${user.username} has no public key, skipping`);
        continue;
      }

      const peer = peerMap.get(user.publicKey);

      if (peer) {
        // Check if peer has had a recent handshake
        // User is online if handshake is within 2 minutes (120 seconds)
        const handshakeAge = now - peer.latestHandshake;
        const isConnected = peer.latestHandshake > 0 && handshakeAge < timeoutSeconds;

        // Determine if we should update connectedAt (only on state transition to connected)
        const shouldUpdateConnectedAt = isConnected && !user.isConnected;
        const newConnectedAt = shouldUpdateConnectedAt ? new Date() : user.connectedAt;

        // Extract IP address from endpoint (format: "IP:port" or just "IP")
        // Store only the IP address part, not the port
        const endpointIp = peer.endpoint ? peer.endpoint.split(':')[0] : null;

        // Convert Unix timestamp to Date (latestHandshake is in seconds)
        const lastHandshakeDate = peer.latestHandshake > 0
          ? new Date(peer.latestHandshake * 1000)
          : null;

        // Track cumulative transfer (detect resets/reconnects)
        // totalBytes stores cumulative from all PAST sessions
        // bytesReceived/bytesSent store CURRENT session values
        let newTotalBytesReceived = user.totalBytesReceived;
        let newTotalBytesSent = user.totalBytesSent;

        // Check if counters decreased (reset detected - user reconnected or WireGuard restarted)
        if (peer.transferRx < user.bytesReceived || peer.transferTx < user.bytesSent) {
          // Add previous session stats to cumulative total before resetting
          newTotalBytesReceived = user.totalBytesReceived + user.bytesReceived;
          newTotalBytesSent = user.totalBytesSent + user.bytesSent;
          console.log(`[WireGuard] ${user.username}: Reset detected, saving session to cumulative (rx: ${user.bytesReceived}, tx: ${user.bytesSent})`);
        }

        // Calculate transfer rate (bytes per second)
        // Rate = (current - previous) / time interval
        // Note: prevBytes are from the last sync (10 seconds ago)
        let bytesReceivedRate = BigInt(0);
        let bytesSentRate = BigInt(0);

        if (user.prevBytesReceived > BigInt(0) || user.prevBytesSent > BigInt(0)) {
          // Calculate delta from previous sync
          const deltaReceived = peer.transferRx - user.prevBytesReceived;
          const deltaSent = peer.transferTx - user.prevBytesSent;

          // Divide by 10 seconds to get bytes per second
          // Only calculate if delta is positive (no reset occurred)
          if (deltaReceived >= BigInt(0) && deltaSent >= BigInt(0)) {
            bytesReceivedRate = deltaReceived / BigInt(10);
            bytesSentRate = deltaSent / BigInt(10);
          }
        }

        // Debug logging
        if (shouldUpdateConnectedAt) {
          console.log(`[WireGuard] ${user.username}: Marking as newly connected, setting connectedAt to now`);
        }

        // Always sync the data from WireGuard to database
        await prisma.vPNUser.update({
          where: { id: user.id },
          data: {
            isConnected,
            connectedAt: newConnectedAt,
            endpoint: endpointIp,
            lastHandshake: lastHandshakeDate,
            bytesReceived: peer.transferRx,
            bytesSent: peer.transferTx,
            prevBytesReceived: peer.transferRx, // Store current as previous for next sync
            prevBytesSent: peer.transferTx,
            bytesReceivedRate,
            bytesSentRate,
            totalBytesReceived: newTotalBytesReceived,
            totalBytesSent: newTotalBytesSent,
          },
        });

        if (isConnected) {
          connectedCount++;
          console.log(
            `[WireGuard] ${user.username}: ONLINE (handshake ${handshakeAge}s ago, rx=${peer.transferRx}, tx=${peer.transferTx})`
          );
        } else {
          disconnectedCount++;
          console.log(
            `[WireGuard] ${user.username}: OFFLINE (handshake ${handshakeAge}s ago, exceeds 2 minute timeout)`
          );
        }
      } else {
        // User not found in WireGuard status, mark as disconnected
        if (user.isConnected) {
          await prisma.vPNUser.update({
            where: { id: user.id },
            data: {
              isConnected: false,
              endpoint: null,
              lastHandshake: null,
            },
          });
          disconnectedCount++;
          console.log(`[WireGuard] ${user.username}: OFFLINE (not in wg status)`);
        }
      }
    }

    console.log(`[WireGuard] Sync complete: ${connectedCount} online, ${disconnectedCount} offline`);

    // Record bandwidth snapshot for time series chart
    try {
      // Calculate total bandwidth rate from all connected users
      const connectedUsers = await prisma.vPNUser.findMany({
        where: {
          isConnected: true,
          server: {
            protocol: 'wireguard',
          },
        },
        select: {
          id: true,
          bytesReceivedRate: true,
          bytesSentRate: true,
        },
      });

      let totalDownloadRate = BigInt(0);
      let totalUploadRate = BigInt(0);

      for (const user of connectedUsers) {
        totalDownloadRate += user.bytesReceivedRate;
        totalUploadRate += user.bytesSentRate;
      }

      // Store snapshot in database
      await prisma.bandwidthSnapshot.create({
        data: {
          downloadRate: totalDownloadRate,
          uploadRate: totalUploadRate,
        },
      });

      console.log(`[WireGuard] Recording bandwidth snapshot: download=${totalDownloadRate} B/s, upload=${totalUploadRate} B/s`);

      // Cleanup old snapshots (keep last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await prisma.bandwidthSnapshot.deleteMany({
        where: {
          timestamp: {
            lt: twentyFourHoursAgo,
          },
        },
      });
    } catch (error) {
      console.error('[WireGuard] Failed to record bandwidth snapshot:', error);
    }

    // Update sync info for monitoring
    try {
      const { updateSyncInfo } = await import('@/app/api/sync/info/route');
      updateSyncInfo('success');
    } catch {
      // Ignore if update fails
    }
  } catch (error: any) {
    console.error('[WireGuard] Failed to sync status:', error);

    // Update sync info with error
    try {
      const { updateSyncInfo } = await import('@/app/api/sync/info/route');
      updateSyncInfo('error', error.message);
    } catch {
      // Ignore if update fails
    }
  }
}

/**
 * Reload WireGuard configuration
 * Regenerates config file and applies it to the interface without disconnecting clients
 */
export async function reloadWireGuardConfig(interfaceName = 'wg0'): Promise<boolean> {
  try {
    console.log('Reloading WireGuard configuration...');

    // Generate and write new config
    const success = await writeWireGuardConfig();
    if (!success) {
      console.error('Failed to write WireGuard configuration');
      return false;
    }

    // Check if interface exists (might be utunX on macOS)
    const actualInterface = await getActualInterfaceName(interfaceName);
    if (actualInterface) {
      // Interface exists, use live sync to avoid disconnecting clients
      console.log(`Found existing interface: ${actualInterface}`);
      const synced = await syncWireGuardConfigLive(interfaceName);
      if (!synced) {
        console.error('Failed to sync WireGuard configuration');
        return false;
      }
    } else {
      // Interface doesn't exist, bring it up fresh
      console.log(`No existing interface found, bringing up ${interfaceName}`);
      const brought = await bringUpWireGuard(interfaceName);
      if (!brought) {
        console.error('Failed to bring up WireGuard interface');
        return false;
      }
    }

    console.log('WireGuard configuration reloaded successfully');
    return true;
  } catch (error) {
    console.error('Failed to reload WireGuard configuration:', error);
    return false;
  }
}

/**
 * Initialize WireGuard on startup
 */
export async function initializeWireGuard(interfaceName = 'wg0'): Promise<void> {
  try {
    console.log('[WireGuard] Initializing...');

    // Check if WireGuard tools are available
    try {
      await execAsync('which wg');
      await execAsync('which wg-quick');
    } catch {
      console.warn('[WireGuard] WireGuard tools (wg/wg-quick) not found in PATH');
      console.warn('[WireGuard] Please install wireguard-tools to enable WireGuard functionality');
      return;
    }

    // Check if we're running with sufficient permissions
    try {
      const { stdout } = await execAsync('id -u');
      if (stdout.trim() !== '0') {
        console.warn('[WireGuard] Not running as root. WireGuard may require elevated privileges.');
      }
    } catch {
      console.warn('[WireGuard] Unable to check user permissions');
    }

    // Generate and apply configuration
    const reloaded = await reloadWireGuardConfig(interfaceName);
    if (!reloaded) {
      console.warn('[WireGuard] Failed to initialize configuration');
      return;
    }

    // Do initial sync
    await syncWireGuardStatus(interfaceName);

    console.log('[WireGuard] ✓ Initialized successfully');
  } catch (error) {
    console.error('[WireGuard] Initialization error:', error);
  }
}

/**
 * Start WireGuard sync service
 * Polls WireGuard status every 10 seconds
 */
export function startWireGuardSyncService(interfaceName = 'wg0', intervalMs = 10000): NodeJS.Timeout {
  console.log(`[WireGuard] Starting sync service (interval: ${intervalMs}ms)`);

  const interval = setInterval(async () => {
    await syncWireGuardStatus(interfaceName);
  }, intervalMs);

  return interval;
}
