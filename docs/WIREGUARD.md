# WireGuard Integration

This document explains how WireGuard is integrated into the NetPlug Dashboard.

## Overview

The dashboard uses `wg-quick` to manage the WireGuard interface and `wg` commands to monitor connection status. All configuration is automatically synchronized between the database and the running WireGuard interface.

## Platform-Specific Interface Naming

### macOS
On macOS, WireGuard uses `utun` (userspace tunnel) interfaces instead of standard interface names:
- Configuration file: `wg0.conf`
- Actual interface created: `utun8` (or similar, number assigned by macOS)
- When running `wg-quick up wg0.conf`, it outputs: `[+] Interface for wg0 is utun8`

The system automatically detects the actual interface name by:
1. Running `wg show interfaces` to list all WireGuard interfaces
2. Mapping the configuration name to the actual interface
3. Using the detected interface for all `wg` commands

### Linux
On Linux, WireGuard typically creates interfaces with the config name:
- Configuration file: `wg0.conf`
- Actual interface: `wg0`
- Direct 1:1 mapping between config name and interface name

## Architecture

### Components

1. **Config Generator** (`lib/wireguard/config-generator.ts`)
   - Generates `wg0.conf` from database configuration
   - Creates server configuration with all active peers
   - Generates client configurations for individual users

2. **Sync Service** (`lib/wireguard/sync-service.ts`)
   - Manages WireGuard interface lifecycle using `wg-quick`
   - Syncs connection status from WireGuard to database
   - Provides live reload without disconnecting clients

3. **Startup Integration** (`lib/startup.ts`)
   - Initializes WireGuard on server startup
   - Starts background sync service (every 30 seconds)

## How It Works

### On Startup

1. **Database Check**: Verifies database is initialized
2. **Config Generation**: Creates `wg0.conf` from database
3. **Interface Creation**: Uses `wg-quick up /path/to/wg0.conf` to:
   - Create the `wg0` interface
   - Configure IP address
   - Run PostUp scripts (NAT, routing, etc.)
   - Add all configured peers
4. **Background Sync**: Starts monitoring service

### Live Configuration Reload

When users are added, updated, or deleted:

1. **Regenerate Config**: Update `wg0.conf` with new peer list
2. **Live Sync**: Use `wg syncconf wg0 <(wg-quick strip wg0.conf)` to:
   - Apply peer changes without disconnecting existing clients
   - Add new peers
   - Remove deleted peers
   - Update peer configurations

This approach keeps existing connections alive during configuration updates.

### Connection Monitoring

Every 30 seconds, the sync service:

1. Runs `wg show wg0 dump` to get real-time status
2. Parses peer information:
   - Public keys
   - Latest handshake timestamps
   - Data transfer (RX/TX bytes)
   - Endpoints
3. Determines online/offline status:
   - Uses `persistent_keepalive × 3` as timeout
   - User is online if handshake age < timeout
   - More robust than fixed timeout
4. Updates database:
   - Sets `isConnected` based on handshake age
   - Updates `bytesReceived` and `bytesSent`
   - Records `connectedAt` timestamp

For detailed information about the sync process, see [WIREGUARD_SYNC.md](WIREGUARD_SYNC.md).

## API Endpoints

### GET `/api/wireguard/status`
Get current WireGuard interface status directly from `wg show`.

### POST `/api/wireguard/reload`
Trigger configuration reload (live sync without disconnecting clients).

### POST `/api/wireguard/restart`
Full restart of WireGuard interface (brings down then up with `wg-quick`).

## Commands Used

### Interface Management
- `wg-quick up /path/to/wg0.conf` - Bring up interface with configuration
- `wg-quick down /path/to/wg0.conf` - Bring down interface
- `wg syncconf <interface> <(wg-quick strip wg0.conf)` - Live reload without disconnect
  - Note: `<interface>` is the actual interface (e.g., `utun8` on macOS, `wg0` on Linux)

### Monitoring
- `wg show interfaces` - List all WireGuard interfaces (used for auto-detection)
- `wg show <interface> dump` - Get detailed status in parseable format
- `wg show <interface>` - Human-readable status

### Interface Detection
The system automatically detects the actual interface name:
```bash
# List all WireGuard interfaces
wg show interfaces

# On macOS might return: utun8
# On Linux might return: wg0
```

## Requirements

### System Requirements
- WireGuard kernel module installed
- `wg` and `wg-quick` tools installed
- Root privileges (or appropriate capabilities)

### Environment Variables
- `DATA_DIR` - Directory where `wg0.conf` is stored

## Configuration Flow

```
Database (VPNServer, VPNUser)
    ↓
generateWireGuardConfig()
    ↓
wg0.conf file in DATA_DIR
    ↓
wg-quick up wg0.conf (startup)
  OR
wg syncconf wg0 (live reload)
    ↓
Running WireGuard interface
    ↓
wg show wg0 dump (monitoring)
    ↓
Database sync (connection status)
```

## Automatic Synchronization

The system automatically syncs in both directions:

**Database → WireGuard**
- When users are created/updated/deleted
- Config is regenerated and applied live

**WireGuard → Database**
- Every 30 seconds via background service
- Connection status and data transfer updated

## Error Handling

- If `wg syncconf` fails, falls back to full restart
- Checks for WireGuard tools on startup
- Warns if not running as root
- Continues operation if WireGuard is unavailable (for development)

## Development

In development mode without WireGuard installed:
- Config generation still works
- Interface operations are skipped with warnings
- Dashboard shows mock data or database values
