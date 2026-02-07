# Quick Start Guide

Get NetPlug VPN Dashboard up and running in minutes.

## Prerequisites

- Node.js 20 or higher
- npm or yarn
- (Optional) VPN server (OpenVPN, WireGuard)

## Installation

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/netplug-dashboard.git
cd netplug-dashboard

# Install dependencies
npm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your VPN server details (optional for demo):

```env
VPN_SERVER_HOST=localhost
VPN_SERVER_PORT=7505
VPN_MANAGEMENT_PASSWORD=your_password
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard!

## What You'll See

The dashboard includes:

1. **Overview Page** (`/dashboard`)
   - Server statistics
   - User counts
   - Active connections
   - Network traffic chart

2. **Servers** (`/dashboard/servers`)
   - List of VPN servers
   - Server status and capacity
   - Location information

3. **Users** (`/dashboard/users`)
   - User management
   - Data usage tracking
   - User status monitoring

4. **Connections** (`/dashboard/connections`)
   - Active VPN connections
   - Real-time bandwidth usage
   - Connection management

5. **Configuration** (`/dashboard/config`)
   - Network settings
   - Security configuration
   - DNS settings
   - Connection limits

## Using Mock Data

By default, the dashboard uses mock data located in `lib/mock-data.ts`. This allows you to:

- Explore all features without a VPN server
- Develop and test UI changes
- Understand the data structure

## Connecting to Real VPN Server

To connect to your actual VPN server:

1. Read the [VPN Integration Guide](./VPN_INTEGRATION.md)
2. Implement the connection logic for your VPN type
3. Update API routes in `app/api/`
4. Configure environment variables

### Example: OpenVPN Integration

```typescript
// lib/vpn/openvpn.ts
import net from 'net';

export async function getOpenVPNStatus() {
  const client = net.createConnection(7505, 'localhost');

  client.write('status\n');

  // Parse response and return data
  return parseStatus(response);
}
```

Then update `app/api/servers/route.ts`:

```typescript
import { getOpenVPNStatus } from '@/lib/vpn/openvpn';

export async function GET() {
  const status = await getOpenVPNStatus();
  return NextResponse.json(status);
}
```

## Docker Deployment

### Using Docker Compose

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f dashboard

# Stop
docker-compose down
```

### Using Docker Only

```bash
# Build
docker build -t netplug-dashboard .

# Run
docker run -p 3000:3000 \
  -e VPN_SERVER_HOST=your_host \
  -e VPN_SERVER_PORT=7505 \
  netplug-dashboard
```

## Production Deployment

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/netplug-dashboard)

### Deploy to Other Platforms

- **Netlify**: Connect your GitHub repo
- **Railway**: Import from GitHub
- **DigitalOcean App Platform**: Deploy from GitHub
- **AWS/GCP/Azure**: Use Docker deployment

## Customization

### Change Branding

Edit `components/sidebar.tsx`:

```typescript
<div className="flex h-16 items-center gap-2 px-6">
  <YourLogo className="h-8 w-8" />
  <span className="text-xl font-bold">Your VPN Name</span>
</div>
```

### Modify Colors

Edit `app/globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  /* Add your colors */
}
```

### Add Features

1. Create new components in `components/`
2. Add new pages in `app/dashboard/`
3. Create API routes in `app/api/`
4. Define types in `types/`

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

```bash
# Check for errors
npx tsc --noEmit
```

## Next Steps

1. Read the [VPN Integration Guide](./VPN_INTEGRATION.md)
2. Check out [Contributing Guidelines](../CONTRIBUTING.md)
3. Star the repository on GitHub
4. Join our community discussions

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/yourusername/netplug-dashboard/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/netplug-dashboard/discussions)
- **Documentation**: [Full Documentation](../README.md)

## License

MIT License - feel free to use this project for any purpose!
