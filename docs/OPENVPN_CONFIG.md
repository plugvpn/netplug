# OpenVPN Configuration Guide

This document explains all the OpenVPN configuration options available in the NetPlug VPN Dashboard setup wizard, designed to work with the `kylemanna/openvpn:latest` Docker image.

## Configuration Sections

### 1. Server Settings

#### Server URL
- **Field**: `serverUrl`
- **Description**: Public hostname or IP address clients will use to connect
- **Example**: `vpn.example.com` or `203.0.113.1`
- **Docker Variable**: `OVPN_SERVER_URL`
- **Usage**: This is the address that will be embedded in client `.ovpn` config files

#### Protocol
- **Field**: `protocol`
- **Options**: `udp` (default), `tcp`
- **Description**: Network protocol for VPN connections
- **Recommendation**:
  - **UDP**: Faster, better for streaming/gaming (default)
  - **TCP**: More reliable, works through restrictive firewalls

#### Port
- **Field**: `port`
- **Default**: `1194` (UDP) or `443` (TCP)
- **Range**: 1-65535
- **Description**: Port number for VPN server to listen on
- **Recommendation**:
  - UDP: Use 1194 (standard) or 53 (DNS bypass)
  - TCP: Use 443 (HTTPS port - bypasses most firewalls)

#### Network & Netmask
- **Fields**: `network`, `netmask`
- **Default**: `192.168.255.0` / `255.255.255.0`
- **Description**: VPN internal network subnet
- **Docker Variable**: `OVPN_NETWORK` / `OVPN_NETMASK`
- **Example**: Network `10.8.0.0` with netmask `255.255.255.0` gives 254 possible clients

---

### 2. DNS Settings

#### Primary & Secondary DNS
- **Fields**: `primaryDns`, `secondaryDns`
- **Default**: `8.8.8.8`, `8.8.4.4` (Google DNS)
- **Description**: DNS servers pushed to clients
- **Common Options**:
  - Google: `8.8.8.8`, `8.8.4.4`
  - Cloudflare: `1.1.1.1`, `1.0.0.1`
  - Quad9: `9.9.9.9`, `149.112.112.112`
  - OpenDNS: `208.67.222.222`, `208.67.220.220`

#### Push DNS
- **Field**: `pushDns`
- **Default**: `true`
- **Description**: Whether to push DNS settings to clients
- **Effect**: When enabled, clients will use VPN DNS servers for all queries

---

### 3. Routing

#### Push Routes
- **Field**: `pushRoutes`
- **Format**: Comma-separated list of networks
- **Example**: `10.0.0.0/24, 172.16.0.0/16, 192.168.1.0/24`
- **Description**: Additional routes to push to clients (beyond VPN network)
- **Use Case**: Allow clients to access internal networks

#### Redirect Gateway
- **Field**: `redirectGateway`
- **Default**: `true`
- **Description**: Route all client traffic through VPN
- **Effect**:
  - **Enabled**: All internet traffic goes through VPN (full tunnel)
  - **Disabled**: Only VPN network traffic goes through VPN (split tunnel)

---

### 4. Security Settings

#### Cipher
- **Field**: `cipher`
- **Default**: `AES-256-GCM`
- **Options**:
  - `AES-256-GCM` - Best security (recommended)
  - `AES-128-GCM` - Good security, faster
  - `AES-256-CBC` - Legacy compatibility
  - `AES-128-CBC` - Legacy compatibility
- **Description**: Encryption algorithm for data channel
- **Recommendation**: Use GCM variants for better performance and security

#### Auth Algorithm
- **Field**: `auth`
- **Default**: `SHA256`
- **Options**: `SHA512`, `SHA384`, `SHA256`, `SHA1`
- **Description**: HMAC authentication algorithm
- **Recommendation**: SHA256 or higher

#### TLS Cipher
- **Field**: `tlsCipher`
- **Default**: `TLS-ECDHE-RSA-WITH-AES-128-GCM-SHA256`
- **Description**: Cipher suite for TLS control channel
- **Format**: OpenSSL cipher string
- **Docker Variable**: `OVPN_TLS_CIPHER`

#### TLS Min Version
- **Field**: `tlsVersionMin`
- **Default**: `1.2`
- **Options**: `1.3`, `1.2`, `1.1`
- **Description**: Minimum TLS version for control channel
- **Recommendation**: 1.2 minimum, 1.3 preferred

---

### 5. Advanced Settings

#### Compression
- **Field**: `compression`
- **Default**: `lz4-v2`
- **Options**:
  - None (empty) - No compression
  - `lz4-v2` - Modern, efficient (recommended)
  - `lz4` - Fast compression
  - `lzo` - Legacy compression
- **Note**: Compression has security implications (VORACLE attack), consider disabling

#### Max Clients
- **Field**: `maxClients`
- **Default**: `100`
- **Description**: Maximum number of concurrent client connections
- **Recommendation**: Set based on your server capacity and network size

#### Keepalive
- **Field**: `keepalive`
- **Default**: `10 120`
- **Format**: `<ping-interval> <ping-restart>`
- **Description**:
  - `ping-interval`: Send ping every N seconds
  - `ping-restart`: Restart if no ping response in N seconds
- **Example**: `10 120` = ping every 10s, restart after 120s of silence

#### Verbosity
- **Field**: `verbosity`
- **Default**: `3`
- **Range**: 0-11
- **Levels**:
  - `0` - Silent (no output)
  - `1` - Minimal (errors only)
  - `3` - Normal (default)
  - `5` - Verbose (detailed info)
  - `7` - Very Verbose (debug info)
- **Recommendation**: Use 3 for production, 5+ for troubleshooting

#### Client-to-Client
- **Field**: `clientToClient`
- **Default**: `false`
- **Description**: Allow VPN clients to communicate directly with each other
- **Use Case**: Enable for peer-to-peer applications or shared resources
- **Security**: Disable if clients should only access server resources

#### Duplicate CN
- **Field**: `duplicateCn`
- **Default**: `false`
- **Description**: Allow multiple clients with the same Common Name (CN)
- **Use Case**: Same user connecting from multiple devices simultaneously
- **Security**: Generally keep disabled for better security

---

### 6. Management Interface

#### Management Host
- **Field**: `managementHost`
- **Default**: `localhost`
- **Description**: Host address for OpenVPN management interface
- **Recommendation**: Use `localhost` or `0.0.0.0` (all interfaces)

#### Management Port
- **Field**: `managementPort`
- **Default**: `7505`
- **Range**: 1-65535
- **Description**: Port for OpenVPN management interface
- **Security**: Keep on localhost or firewall this port

#### Management Password
- **Field**: `managementPassword`
- **Required**: Yes
- **Description**: Password for accessing the management interface
- **Security**: Use a strong password, this dashboard uses it to control OpenVPN

---

## Example Configurations

### Configuration 1: Maximum Security
```json
{
  "serverUrl": "vpn.example.com",
  "protocol": "tcp",
  "port": "443",
  "cipher": "AES-256-GCM",
  "auth": "SHA512",
  "tlsVersionMin": "1.3",
  "compression": "",
  "redirectGateway": true,
  "duplicateCn": false,
  "clientToClient": false
}
```

### Configuration 2: Maximum Performance
```json
{
  "serverUrl": "vpn.example.com",
  "protocol": "udp",
  "port": "1194",
  "cipher": "AES-128-GCM",
  "auth": "SHA256",
  "tlsVersionMin": "1.2",
  "compression": "lz4-v2",
  "redirectGateway": true
}
```

### Configuration 3: Split Tunnel (Access Only Internal Network)
```json
{
  "serverUrl": "vpn.example.com",
  "protocol": "udp",
  "port": "1194",
  "redirectGateway": false,
  "pushRoutes": "10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16",
  "pushDns": false
}
```

### Configuration 4: Firewall Bypass
```json
{
  "serverUrl": "vpn.example.com",
  "protocol": "tcp",
  "port": "443",
  "cipher": "AES-256-GCM",
  "redirectGateway": true
}
```

---

## kylemanna/openvpn Docker Commands

### Initialize OpenVPN Server
```bash
# Generate server configuration
docker run -v $OVPN_DATA:/etc/openvpn --rm kylemanna/openvpn ovpn_genconfig \
  -u udp://vpn.example.com:1194 \
  -n 8.8.8.8 \
  -n 8.8.4.4 \
  -p "route 192.168.1.0 255.255.255.0" \
  -e "cipher AES-256-GCM" \
  -e "auth SHA256"

# Initialize PKI
docker run -v $OVPN_DATA:/etc/openvpn --rm -it kylemanna/openvpn ovpn_initpki

# Start server
docker run -v $OVPN_DATA:/etc/openvpn -d -p 1194:1194/udp \
  --cap-add=NET_ADMIN kylemanna/openvpn
```

### Generate Client Certificate
```bash
# Generate client certificate (with password)
docker run -v $OVPN_DATA:/etc/openvpn --rm -it kylemanna/openvpn easyrsa build-client-full CLIENTNAME

# Generate client certificate (without password)
docker run -v $OVPN_DATA:/etc/openvpn --rm -it kylemanna/openvpn easyrsa build-client-full CLIENTNAME nopass

# Retrieve client configuration
docker run -v $OVPN_DATA:/etc/openvpn --rm kylemanna/openvpn ovpn_getclient CLIENTNAME > CLIENTNAME.ovpn
```

### Enable Management Interface
```bash
# Start with management interface on port 7505
docker run -v $OVPN_DATA:/etc/openvpn -d -p 1194:1194/udp -p 7505:7505/tcp \
  --cap-add=NET_ADMIN kylemanna/openvpn \
  --management 0.0.0.0 7505 /etc/openvpn/mgmt-password
```

---

## Troubleshooting

### Connection Issues
- Check firewall allows traffic on configured port
- Verify protocol matches (UDP vs TCP)
- Ensure server URL is reachable from client
- Check DNS resolution

### Performance Issues
- Try UDP instead of TCP
- Disable compression for better security
- Use AES-128-GCM instead of AES-256-GCM
- Reduce verbosity level

### Security Concerns
- Disable compression (VORACLE attack)
- Use TLS 1.3 minimum
- Disable duplicate CN
- Disable client-to-client unless needed
- Use strong ciphers (AES-256-GCM, SHA256+)

---

## References

- [kylemanna/openvpn GitHub](https://github.com/kylemanna/docker-openvpn)
- [OpenVPN Documentation](https://openvpn.net/community-resources/)
- [OpenVPN Security Guide](https://community.openvpn.net/openvpn/wiki/Hardening)
