# WireGuard Configuration Guide

This document explains all the WireGuard configuration options available in the NetPlug VPN Dashboard setup wizard, designed to work with wg-easy and standard WireGuard installations.

## Configuration Sections

### 1. Server Settings

#### Server Host
- **Field**: `serverHost`
- **Description**: Public hostname or IP address clients will use to connect
- **Example**: `vpn.example.com` or `203.0.113.1`
- **Usage**: This is the endpoint that will be embedded in client WireGuard config files
- **wg-easy Variable**: `WG_HOST`

#### Server Port
- **Field**: `serverPort`
- **Default**: `51820`
- **Range**: 1-65535
- **Description**: UDP port for WireGuard server to listen on
- **wg-easy Variable**: `WG_PORT`
- **Recommendation**: Use default 51820 or 443 (HTTPS port - bypasses some firewalls)

#### Server Address
- **Field**: `serverAddress`
- **Default**: `10.8.0.1`
- **Description**: Server's IP address within the VPN network
- **Format**: IPv4 address (e.g., `10.8.0.1`)
- **Note**: This is the internal VPN IP, not the public IP

#### Client Address Range
- **Field**: `clientAddressRange`
- **Default**: `10.8.0.0/24`
- **Description**: CIDR notation for client IP address pool
- **wg-easy Variable**: `WG_DEFAULT_ADDRESS`
- **Examples**:
  - `10.8.0.0/24` - Allows 254 clients (10.8.0.1 to 10.8.0.254)
  - `10.8.0.0/16` - Allows 65,534 clients
  - `192.168.99.0/24` - Custom private range

---

### 2. DNS Settings

#### DNS Servers
- **Field**: `dns`
- **Default**: `1.1.1.1, 1.0.0.1` (Cloudflare DNS)
- **Format**: Comma-separated list of DNS servers
- **wg-easy Variable**: `WG_DEFAULT_DNS`
- **Description**: DNS servers pushed to clients for name resolution
- **Common Options**:
  - Cloudflare: `1.1.1.1, 1.0.0.1`
  - Google: `8.8.8.8, 8.8.4.4`
  - Quad9: `9.9.9.9, 149.112.112.112`
  - AdGuard: `94.140.14.14, 94.140.15.15`
  - Pi-hole: Your Pi-hole server IP

---

### 3. Network Settings

#### MTU (Maximum Transmission Unit)
- **Field**: `mtu`
- **Default**: `1420`
- **Range**: 1280-1500
- **wg-easy Variable**: `WG_MTU`
- **Description**: Maximum packet size for the interface
- **Common Values**:
  - `1420` - Standard WireGuard (recommended)
  - `1400` - For PPPoE connections
  - `1280` - Minimum IPv6 MTU (most compatible)
- **Note**: Lower MTU = better compatibility, slightly worse performance

#### Persistent Keepalive
- **Field**: `persistentKeepalive`
- **Default**: `25`
- **Range**: 0-3600 seconds
- **wg-easy Variable**: `WG_PERSISTENT_KEEPALIVE`
- **Description**: Send keepalive packets every N seconds
- **Values**:
  - `0` - Disabled (no keepalive)
  - `25` - Recommended for most NAT scenarios
  - `15-30` - Good for restrictive NAT/firewalls
  - `60+` - Less frequent keepalive
- **Use Case**: Keeps NAT mappings alive, helps with connection stability

#### Allowed IPs
- **Field**: `allowedIps`
- **Default**: `0.0.0.0/0, ::/0`
- **wg-easy Variable**: `WG_ALLOWED_IPS`
- **Description**: Which traffic should be routed through the VPN
- **Common Configurations**:
  - `0.0.0.0/0, ::/0` - All traffic (full tunnel)
  - `0.0.0.0/0` - All IPv4 traffic only
  - `10.0.0.0/8, 192.168.0.0/16` - Only private networks (split tunnel)
  - `10.8.0.0/24` - Only VPN network traffic

---

### 4. Advanced Settings (iptables)

#### PostUp Script
- **Field**: `postUp`
- **Default**: NAT and forwarding rules
- **Description**: Shell commands executed when the interface comes up
- **wg-easy Variable**: `WG_POST_UP`
- **Format**: Semicolon-separated commands, `%i` = interface name

**Default PostUp:**
```bash
iptables -A FORWARD -i %i -j ACCEPT;
iptables -A FORWARD -o %i -j ACCEPT;
iptables -t nat -A POSTROUTING -o eth+ -j MASQUERADE
```

**Common Variations:**

1. **Standard NAT (IPv4 only)**:
```bash
iptables -A FORWARD -i %i -j ACCEPT;
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
```

2. **With IPv6 Support**:
```bash
iptables -A FORWARD -i %i -j ACCEPT;
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE;
ip6tables -A FORWARD -i %i -j ACCEPT;
ip6tables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
```

3. **With DNS Redirect (to Pi-hole)**:
```bash
iptables -A FORWARD -i %i -j ACCEPT;
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE;
iptables -t nat -A PREROUTING -i %i -p udp --dport 53 -j DNAT --to 10.8.0.1:53
```

4. **Specific Outbound Interface**:
```bash
iptables -A FORWARD -i %i -o ens3 -j ACCEPT;
iptables -A FORWARD -i ens3 -o %i -j ACCEPT;
iptables -t nat -A POSTROUTING -o ens3 -j MASQUERADE
```

#### PostDown Script
- **Field**: `postDown`
- **Default**: Cleanup NAT and forwarding rules
- **Description**: Shell commands executed when the interface goes down
- **wg-easy Variable**: `WG_POST_DOWN`
- **Note**: Should mirror PostUp to clean up rules

**Default PostDown:**
```bash
iptables -D FORWARD -i %i -j ACCEPT;
iptables -D FORWARD -o %i -j ACCEPT;
iptables -t nat -D POSTROUTING -o eth+ -j MASQUERADE
```

**Important**: Use `-D` (delete) instead of `-A` (add) to remove rules

---

## Example Configurations

### Configuration 1: Full Tunnel (All Traffic Through VPN)
```json
{
  "serverHost": "vpn.example.com",
  "serverPort": "51820",
  "serverAddress": "10.8.0.1",
  "clientAddressRange": "10.8.0.0/24",
  "dns": "1.1.1.1, 1.0.0.1",
  "allowedIps": "0.0.0.0/0, ::/0",
  "persistentKeepalive": "25"
}
```

### Configuration 2: Split Tunnel (Only Private Networks)
```json
{
  "serverHost": "vpn.example.com",
  "serverPort": "51820",
  "serverAddress": "10.8.0.1",
  "clientAddressRange": "10.8.0.0/24",
  "dns": "8.8.8.8, 8.8.4.4",
  "allowedIps": "10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12",
  "persistentKeepalive": "0"
}
```

### Configuration 3: Firewall Bypass (Port 443)
```json
{
  "serverHost": "vpn.example.com",
  "serverPort": "443",
  "serverAddress": "10.8.0.1",
  "clientAddressRange": "10.8.0.0/24",
  "dns": "1.1.1.1, 1.0.0.1",
  "allowedIps": "0.0.0.0/0, ::/0",
  "persistentKeepalive": "25",
  "mtu": "1400"
}
```

### Configuration 4: With Pi-hole DNS
```json
{
  "serverHost": "vpn.example.com",
  "serverPort": "51820",
  "serverAddress": "10.8.0.1",
  "clientAddressRange": "10.8.0.0/24",
  "dns": "10.8.0.1",
  "allowedIps": "0.0.0.0/0",
  "persistentKeepalive": "25",
  "postUp": "iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE; iptables -t nat -A PREROUTING -i %i -p udp --dport 53 -j DNAT --to 10.8.0.1:53"
}
```

---

## wg-easy Docker Setup

### Basic Docker Compose
```yaml
version: '3.8'

services:
  wg-easy:
    image: ghcr.io/wg-easy/wg-easy
    container_name: wg-easy
    environment:
      - WG_HOST=vpn.example.com
      - WG_PORT=51820
      - WG_DEFAULT_ADDRESS=10.8.0.x
      - WG_DEFAULT_DNS=1.1.1.1,1.0.0.1
      - WG_MTU=1420
      - WG_PERSISTENT_KEEPALIVE=25
      - WG_ALLOWED_IPS=0.0.0.0/0,::/0
      - PASSWORD=your_admin_password
    ports:
      - "51820:51820/udp"
      - "51821:51821/tcp"
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    sysctls:
      - net.ipv4.ip_forward=1
      - net.ipv4.conf.all.src_valid_mark=1
    volumes:
      - ./wg-easy:/etc/wireguard
    restart: unless-stopped
```

### With Custom PostUp/PostDown
```yaml
services:
  wg-easy:
    image: ghcr.io/wg-easy/wg-easy
    environment:
      - WG_POST_UP=iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
      - WG_POST_DOWN=iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
    # ... other config
```

---

## Standard WireGuard Setup

### Server Configuration File
```ini
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = <server-private-key>
MTU = 1420

# PostUp/PostDown scripts
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
# Client 1
PublicKey = <client-public-key>
AllowedIPs = 10.8.0.2/32
PersistentKeepalive = 25
```

### Generate Keys
```bash
# Generate server keys
wg genkey | tee server_private.key | wg pubkey > server_public.key

# Generate client keys
wg genkey | tee client_private.key | wg pubkey > client_public.key
```

### Enable IP Forwarding
```bash
# Temporary
sysctl -w net.ipv4.ip_forward=1

# Permanent
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p
```

---

## Client Configuration Example

```ini
[Interface]
PrivateKey = <client-private-key>
Address = 10.8.0.2/24
DNS = 1.1.1.1, 1.0.0.1
MTU = 1420

[Peer]
PublicKey = <server-public-key>
Endpoint = vpn.example.com:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
```

---

## Troubleshooting

### Connection Issues
- Verify UDP port is open in firewall
- Check server can receive packets on WireGuard port
- Ensure `net.ipv4.ip_forward=1` is enabled
- Verify public key exchange between client/server

### NAT/Routing Issues
- Check iptables rules are correctly applied
- Verify MASQUERADE rule uses correct output interface
- Test with: `iptables -t nat -L -n -v`
- Ensure no conflicting rules

### Performance Issues
- Try lowering MTU (1400, 1380, 1280)
- Reduce persistent keepalive or disable (0)
- Check for packet fragmentation
- Use `ping -M do -s 1400` to test MTU

### DNS Issues
- Verify DNS servers are reachable from server
- Check if DNS queries are being forwarded
- Test with: `nslookup google.com <dns-server>`
- Ensure DNS isn't blocked by firewall

---

## Security Best Practices

1. **Use Strong Keys**: WireGuard generates cryptographically secure keys automatically
2. **Restrict Allowed IPs**: Only allow necessary traffic ranges
3. **Rotate Keys**: Periodically regenerate keys for clients
4. **Firewall Rules**: Only open WireGuard port, close others
5. **Regular Updates**: Keep WireGuard and kernel updated
6. **Monitor Logs**: Check for unauthorized connection attempts
7. **Client Management**: Remove unused client configs promptly

---

## Comparison: WireGuard vs OpenVPN

| Feature | WireGuard | OpenVPN |
|---------|-----------|---------|
| **Speed** | ⚡⚡⚡ Very Fast | ⚡⚡ Moderate |
| **Security** | Modern cryptography | Proven security |
| **Code Size** | ~4,000 lines | ~100,000+ lines |
| **Setup** | Easier | More complex |
| **Compatibility** | UDP only | UDP/TCP |
| **Battery Life** | Better | Good |
| **Roaming** | Seamless | Reconnect needed |
| **Port Blocking** | Less options | Can use TCP 443 |

---

## References

- [WireGuard Official Documentation](https://www.wireguard.com/)
- [wg-easy GitHub](https://github.com/wg-easy/wg-easy)
- [WireGuard Quick Start](https://www.wireguard.com/quickstart/)
- [ArchWiki WireGuard](https://wiki.archlinux.org/title/WireGuard)
