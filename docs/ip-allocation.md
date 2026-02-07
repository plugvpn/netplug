# Automatic IP Address Allocation

## Overview

The NetPlug Dashboard automatically assigns VPN IP addresses to WireGuard users based on the configured client address range.

## How It Works

### Configuration Example
- **Client Address Range**: `10.5.10.0/24`
- **Server Address**: `10.5.10.1`
- **Available IPs**: `10.5.10.2` - `10.5.10.254`

### IP Assignment Logic

1. **First User** → `10.5.10.2`
2. **Second User** → `10.5.10.3`
3. **Third User** → `10.5.10.4`
4. And so on...

### Reserved Addresses

The system automatically excludes:
- **Network Address** (e.g., `10.5.10.0`) - Reserved for network identification
- **Server Address** (e.g., `10.5.10.1`) - Reserved for the WireGuard server
- **Broadcast Address** (e.g., `10.5.10.255`) - Reserved for broadcast

### IP Reuse

When a user is deleted, their IP address becomes available for assignment to new users.

## Implementation Details

### API Endpoint: `/api/users` (POST)

When creating a WireGuard user:
1. Fetches the WireGuard configuration from SystemConfig
2. Extracts `clientAddressRange` (e.g., `10.5.10.0/24`)
3. Extracts `serverAddress` (e.g., `10.5.10.1`)
4. Queries all existing users on the same server to get used IPs
5. Calculates the next available IP using the allocation algorithm
6. Assigns the IP to the new user

### Allocation Algorithm

```typescript
// Example: 10.5.10.0/24
// Network: 10.5.10.0
// Server: 10.5.10.1
// Start: 10.5.10.2
// End: 10.5.10.254

for (let i = 2; i < totalHosts - 1; i++) {
  const candidateIp = networkAddress + i;
  if (!isUsed(candidateIp)) {
    return candidateIp;
  }
}
```

## User Interface

### Users Table
- VPN IP addresses are displayed below the username
- Shown in emerald color for easy identification
- Font: Monospace for better readability

### Add User Modal
For WireGuard users, displays an info box:
> **VPN IP Address:** Automatically assigned from the WireGuard client address range

## Error Handling

### IP Range Exhausted
If all available IPs in the range are used:
```json
{
  "error": "No available IP addresses in the configured range"
}
```

**Solution**: Either:
- Delete unused users to free up IPs
- Expand the client address range in WireGuard configuration

### Server Not Found
If the selected server doesn't exist:
```json
{
  "error": "Server not found"
}
```

## Examples

### /24 Network (254 usable addresses)
- Range: `10.5.10.0/24`
- Server: `10.5.10.1`
- Users: `10.5.10.2` - `10.5.10.254` (253 available)

### /25 Network (126 usable addresses)
- Range: `10.5.10.0/25`
- Server: `10.5.10.1`
- Users: `10.5.10.2` - `10.5.10.126` (125 available)

### /16 Network (65,534 usable addresses)
- Range: `10.5.0.0/16`
- Server: `10.5.0.1`
- Users: `10.5.0.2` - `10.5.255.254` (65,533 available)
