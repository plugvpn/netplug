# WireGuard Configuration Sync

## Overview

The NetPlug Dashboard automatically generates and syncs the WireGuard server configuration file (`wg0.conf`) based on the users in the database.

## Configuration File Location

The configuration file is stored at:
```
$DATA_DIR/wg0.conf
```

Where `DATA_DIR` is defined in your `.env` file:
```
DATA_DIR=/Users/josh/code/work/freeiran/netplug-dashboard/sandbox/data
```

## When Configuration is Synced

The `wg0.conf` file is automatically regenerated in the following scenarios:

### 1. Server Startup
- When the Next.js server starts, the configuration is generated
- Runs via the `instrumentation.ts` hook
- Logs: `[Startup] ✓ WireGuard configuration generated successfully`

### 2. User Created
- After successfully creating a new WireGuard user
- Triggered in `POST /api/users`
- Logs: `[WireGuard] Configuration synced after creating user: username`

### 3. User Updated
- After updating a WireGuard user (especially `isEnabled` status)
- Triggered in `PATCH /api/users/[id]`
- Logs: `[WireGuard] Configuration synced after updating user: username`

### 4. User Deleted
- After deleting a WireGuard user
- Triggered in `DELETE /api/users/[id]`
- Logs: `[WireGuard] Configuration synced after deleting user: username`

## Configuration File Format

```ini
# WireGuard Server Configuration
# Generated at: 2026-02-07T18:16:23.182Z
# DO NOT EDIT MANUALLY - This file is auto-generated

[Interface]
Address = 10.5.10.1
ListenPort = 443
PostUp = iptables -A FORWARD -i %i -j ACCEPT; ...
PostDown = iptables -D FORWARD -i %i -j ACCEPT; ...
PrivateKey = <SERVER_PRIVATE_KEY>

# MTU Configuration
MTU = 1420

# ========== Client Peers ==========

# User: john_doe
[Peer]
PublicKey = <PUBLIC_KEY_FOR_JOHN_DOE>
AllowedIPs = 10.5.10.2/32
PersistentKeepalive = 25

# User: jane_smith
[Peer]
PublicKey = <PUBLIC_KEY_FOR_JANE_SMITH>
AllowedIPs = 10.5.10.3/32
PersistentKeepalive = 25
```

## Important Notes

### 1. Only Enabled Users
- Only users with `isEnabled: true` are included in the configuration
- Disabled users are excluded from the `wg0.conf` file
- This allows temporary user suspension without deletion

### 2. IP Address Requirement
- Users without an IP address are skipped
- Warning logged: `User {username} has no IP address assigned, skipping`

### 3. Private/Public Keys
- The configuration includes placeholders for keys:
  - `<SERVER_PRIVATE_KEY>` - Server's private key
  - `<PUBLIC_KEY_FOR_{USERNAME}>` - Each user's public key
- These placeholders must be replaced with actual keys manually or via automation

### 4. WireGuard Server Only
- Configuration sync only happens for WireGuard protocol
- OpenVPN users do not trigger configuration regeneration

## Implementation Files

### Core Generator
- `lib/wireguard/config-generator.ts`
  - `generateWireGuardConfig()` - Generate config content
  - `writeWireGuardConfig()` - Write to file system
  - `generateClientConfig()` - Generate client configuration

### Startup Hook
- `instrumentation.ts` - Next.js instrumentation hook
- `lib/startup.ts` - Startup tasks runner

### API Integration
- `app/api/users/route.ts` - User creation (POST)
- `app/api/users/[id]/route.ts` - User update (PATCH) and delete (DELETE)

## Client Configuration

You can also generate client configurations for individual users:

```typescript
import { generateClientConfig } from '@/lib/wireguard/config-generator';

const clientConfig = await generateClientConfig(userId);
```

This generates a client-side WireGuard configuration:
```ini
# WireGuard Client Configuration
# User: john_doe
# Generated at: 2026-02-07T18:16:23.182Z

[Interface]
PrivateKey = <CLIENT_PRIVATE_KEY>
Address = 10.5.10.2/32
DNS = 1.1.1.1, 8.8.8.8
MTU = 1420

[Peer]
PublicKey = <SERVER_PUBLIC_KEY>
Endpoint = vpn.example.com:443
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
```

## Manual Regeneration

If you need to manually regenerate the configuration:

```typescript
import { writeWireGuardConfig } from '@/lib/wireguard/config-generator';

await writeWireGuardConfig();
```

## Troubleshooting

### Configuration not generated
- Check that `DATA_DIR` is set in `.env`
- Verify the directory exists and is writable
- Check server logs for errors

### Users not appearing in config
- Ensure user has `isEnabled: true`
- Verify user has an IP address assigned
- Check that server protocol is `wireguard`

### File permissions
- Ensure the application has write permissions to `DATA_DIR`
- On Linux/Mac: `chmod 755 $DATA_DIR`
