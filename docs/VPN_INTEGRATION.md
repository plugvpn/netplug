# VPN Server Integration Guide

This guide explains how to integrate NetPlug Dashboard with your VPN server.

## Supported VPN Solutions

### OpenVPN

OpenVPN provides a management interface that can be used to monitor and control the server.

#### Setup

1. Enable OpenVPN management interface in your server config:
```conf
management 127.0.0.1 7505
management-client-auth
```

2. Update environment variables:
```env
VPN_SERVER_HOST=localhost
VPN_SERVER_PORT=7505
VPN_MANAGEMENT_PASSWORD=your_password
```

3. Implement connection logic in `lib/vpn/openvpn.ts`:
```typescript
import net from 'net';

export class OpenVPNManager {
  private host: string;
  private port: number;
  private password: string;

  constructor(host: string, port: number, password: string) {
    this.host = host;
    this.port = port;
    this.password = password;
  }

  async connect(): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(this.port, this.host);

      client.on('connect', () => {
        client.write(`${this.password}\n`);
        resolve(client);
      });

      client.on('error', reject);
    });
  }

  async getStatus(): Promise<string> {
    const client = await this.connect();

    return new Promise((resolve, reject) => {
      client.write('status\n');

      let data = '';
      client.on('data', (chunk) => {
        data += chunk.toString();
        if (data.includes('END')) {
          client.end();
          resolve(data);
        }
      });

      client.on('error', reject);
    });
  }

  async killClient(commonName: string): Promise<void> {
    const client = await this.connect();
    client.write(`kill ${commonName}\n`);
    client.end();
  }
}
```

### WireGuard

WireGuard can be managed using the `wg` command-line tool.

#### Setup

1. Create a script to execute WireGuard commands:
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class WireGuardManager {
  async getStatus(): Promise<string> {
    const { stdout } = await execAsync('wg show all dump');
    return stdout;
  }

  async addPeer(publicKey: string, allowedIPs: string): Promise<void> {
    await execAsync(`wg set wg0 peer ${publicKey} allowed-ips ${allowedIPs}`);
  }

  async removePeer(publicKey: string): Promise<void> {
    await execAsync(`wg set wg0 peer ${publicKey} remove`);
  }

  parseStatus(dump: string) {
    // Parse WireGuard dump format
    const lines = dump.split('\n');
    const peers = [];

    for (const line of lines) {
      const [iface, publicKey, endpoint, allowedIPs, latestHandshake, transferRx, transferTx] = line.split('\t');
      if (publicKey) {
        peers.push({
          publicKey,
          endpoint,
          allowedIPs,
          latestHandshake: new Date(parseInt(latestHandshake) * 1000),
          transferRx: parseInt(transferRx),
          transferTx: parseInt(transferTx),
        });
      }
    }

    return peers;
  }
}
```

## API Routes Implementation

### Update Server API

Edit `app/api/servers/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { OpenVPNManager } from "@/lib/vpn/openvpn";

const vpnManager = new OpenVPNManager(
  process.env.VPN_SERVER_HOST!,
  parseInt(process.env.VPN_SERVER_PORT!),
  process.env.VPN_MANAGEMENT_PASSWORD!
);

export async function GET() {
  try {
    const status = await vpnManager.getStatus();
    // Parse status and return server information
    return NextResponse.json({ status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch server status" },
      { status: 500 }
    );
  }
}
```

### Update Connections API

Edit `app/api/connections/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { OpenVPNManager } from "@/lib/vpn/openvpn";

const vpnManager = new OpenVPNManager(
  process.env.VPN_SERVER_HOST!,
  parseInt(process.env.VPN_SERVER_PORT!),
  process.env.VPN_MANAGEMENT_PASSWORD!
);

export async function GET() {
  try {
    const status = await vpnManager.getStatus();
    // Parse and return active connections
    return NextResponse.json({ connections: parseConnections(status) });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("id");

  try {
    await vpnManager.killClient(clientId!);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to disconnect client" },
      { status: 500 }
    );
  }
}
```

## Database Integration

For persistent storage of users and servers:

### Schema Example (Prisma)

```prisma
model Server {
  id               String   @id @default(cuid())
  name             String
  host             String
  port             Int
  protocol         String
  location         String
  capacity         Int
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  users            User[]
}

model User {
  id               String   @id @default(cuid())
  username         String   @unique
  email            String   @unique
  passwordHash     String
  status           String
  createdAt        DateTime @default(now())
  expiresAt        DateTime?
  serverId         String?
  server           Server?  @relation(fields: [serverId], references: [id])
  connections      Connection[]
}

model Connection {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  ipAddress        String
  connectedAt      DateTime @default(now())
  disconnectedAt   DateTime?
  bytesReceived    BigInt
  bytesSent        BigInt
}
```

## Security Best Practices

1. **Never expose management interface publicly**
   - Keep management interface on localhost
   - Use firewall rules to restrict access

2. **Use strong passwords**
   - Generate secure management passwords
   - Store in environment variables

3. **Implement authentication**
   - Add user authentication to dashboard
   - Use role-based access control

4. **Enable HTTPS**
   - Always use HTTPS in production
   - Use valid SSL certificates

5. **Rate limiting**
   - Implement rate limiting on API routes
   - Prevent brute force attacks

## Testing

Test your integration:

```bash
# Test OpenVPN connection
telnet localhost 7505

# Test WireGuard
wg show

# Test API endpoints
curl http://localhost:3000/api/servers
curl http://localhost:3000/api/connections
```

## Troubleshooting

### Connection refused
- Check if management interface is enabled
- Verify host and port settings
- Check firewall rules

### Authentication failed
- Verify management password
- Check password format (no newlines)

### Permission denied
- Run with appropriate user permissions
- Check file ownership for WireGuard configs

## Next Steps

1. Implement real-time updates using WebSockets
2. Add certificate management for OpenVPN
3. Implement user provisioning automation
4. Add monitoring and alerting
5. Create backup and restore functionality
