# WireGuard Permissions

## Overview

WireGuard commands (`wg`, `wg-quick`) typically require elevated privileges (root/sudo) to access interface information and make configuration changes.

## Symptoms of Permission Issues

If you see these messages in the logs:
```
[WireGuard] Using interface 'utun8' for config 'wg0'
WireGuard interface wg0 not found
```

Or:
```
[WireGuard] Permission denied - WireGuard commands require root/sudo access
[WireGuard] Operation not permitted
```

This means the application can detect WireGuard interfaces but cannot read their details due to permission restrictions.

## Solutions

### Option 1: Run with sudo (Development)

The simplest approach for development:

```bash
sudo npm run dev
```

Or with environment variables:

```bash
sudo DATA_DIR=./sandbox/data npm run dev
```

**Note**: You may need to preserve environment variables:

```bash
sudo -E npm run dev
```

### Option 2: Run as root user (Production)

In Docker or production environments:

```dockerfile
# Dockerfile
FROM node:20-alpine
# ... build steps ...
USER root
CMD ["npm", "start"]
```

### Option 3: Grant capabilities (Linux only)

On Linux, you can grant specific capabilities to the Node.js binary:

```bash
# Grant NET_ADMIN capability
sudo setcap cap_net_admin=eip $(which node)

# Now run without sudo
npm run dev
```

**Warning**: This allows the Node process to modify network interfaces system-wide. Use with caution.

### Option 4: Use sudoers file (Advanced)

Allow specific commands to run without password:

```bash
# Edit sudoers file
sudo visudo

# Add this line (replace 'username' with your username):
username ALL=(ALL) NOPASSWD: /usr/bin/wg, /usr/bin/wg-quick
```

Then modify the code to use sudo for wg commands:

```typescript
// Example (not implemented by default)
await execAsync('sudo wg show interfaces')
```

## Checking Permissions

Visit the diagnostics endpoint to check your current permissions:

```bash
curl http://localhost:3000/api/wireguard/diagnostics | jq
```

This will show:
- Whether `wg` and `wg-quick` are installed
- Current user and user ID
- Whether interfaces can be listed
- Whether interface details can be read

## macOS Specific Notes

On macOS:
- WireGuard uses `utun` interfaces
- The `wg` command always requires root access
- Even listing interfaces (`wg show interfaces`) may work without root, but reading details (`wg show utun8`) requires root

## Docker Deployment

When running in Docker:

```yaml
# docker-compose.yml
services:
  netplug-dashboard:
    image: netplug-dashboard
    privileged: true  # Grant full access
    cap_add:
      - NET_ADMIN     # Or specific capabilities
    user: root        # Or run as root
    volumes:
      - /dev/net/tun:/dev/net/tun  # Access to TUN devices
```

## Security Considerations

Running as root has security implications:
- **Development**: Generally acceptable
- **Production**: Consider using capabilities or sudoers instead
- **Docker**: Running as root inside a container is more isolated

Always follow the principle of least privilege when possible.

## Testing Without Permissions

If you cannot run with elevated permissions:
- The dashboard will still work
- Database-stored statistics will be shown
- Real-time WireGuard data will not be available
- Configuration generation will still work
- You'll see warnings in the logs but the app will continue

## Recommended Setup

**Development (macOS/Linux)**:
```bash
sudo npm run dev
```

**Production (Docker)**:
```yaml
services:
  app:
    user: root
    cap_add:
      - NET_ADMIN
```

**Production (Bare Metal Linux)**:
```bash
sudo setcap cap_net_admin=eip $(which node)
npm start
```
