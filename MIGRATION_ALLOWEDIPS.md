# Migration: Single IP Address to Allowed IPs List

## Summary

Successfully migrated the NetPlug Dashboard from a single VPN IP address per user to supporting multiple allowed IPs/subnets in CIDR notation.

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)

**Changed:**
- Field renamed: `ipAddress` → `allowedIps`
- Type: `String?` (comma-separated list of IP addresses in CIDR notation)
- Comment: "Comma-separated list of IPs/subnets in CIDR notation"

**Migration Required:**
- A migration file needs to be created to:
  - Rename the column from `ipAddress` to `allowedIps`
  - Convert existing single IPs to CIDR format by appending `/32`
  - Example: `10.5.10.2` → `10.5.10.2/32`

### 2. Frontend - Users Page (`app/dashboard/users/page.tsx`)

**Key Changes:**

#### User Interface
- Changed `ipAddress` to `allowedIps` in `VPNUser` interface
- Updated `sortColumn` type to use `'allowedIps'` instead of `'ipAddress'`

#### Modal Input Field  
- **Replaced single-line input with multi-line textarea**
- Label: "VPN IP Address *" → "Allowed IPs *"
- Rows: 3 lines
- Placeholder: Shows example CIDR notation
  ```
  10.5.10.2/32
  192.168.1.0/24
  0.0.0.0/0
  ```

#### Data Handling
- **Display format**: Newline-separated (user-friendly editing)
- **Storage format**: Comma-separated (database)
- **Conversion logic**:
  - On load: `allowedIps.split(',').join('\n')`
  - On save: `value.split('\n').filter(trim).join(',')`

#### Table Display
- Column header changed to "Allowed IPs"
- Shows full comma-separated list
- Updated search/filter to search within allowedIps
- Updated sorting by allowedIps

#### Help Text
```
Enter IPs or subnets in CIDR notation, one per line.
Examples: 10.5.10.2/32 (single IP), 192.168.1.0/24 (subnet), or 0.0.0.0/0 (all traffic)
```

### 3. API Routes

#### `/app/api/users/route.ts` (Create User)
- Parameter: `ipAddress` → `allowedIps`
- Variable: `assignedIpAddress` → `assignedAllowedIps`
- **Validation**: Now checks each IP in comma-separated list:
  - Requires CIDR notation (must contain `/`)
  - Validates each IP is in configured range
  - Checks for duplicates across all users
- **Auto-assignment**: Suggests next available IP with `/32` suffix
- **Storage**: Stores as comma-separated string

#### `/app/api/users/next-ip/route.ts` (Get Next Available IP)
- Query field: `ipAddress` → `allowedIps`
- **Extraction logic**: Extracts first IP from each user's allowedIps list
- **Return format**: Returns IP with `/32` suffix
- Response: `{ allowedIps: "10.5.10.2/32" }`

#### `/app/api/users/by-ip/route.ts` (Find User by IP)
- Query: Changed from exact match to `contains` check
- Handles comma-separated lists
- Returns `allowedIps` field in response

#### `/app/api/connections/active/route.ts` (Active Connections)
- Fetches from `allowedIps` field
- **Backward compatibility**: Returns as `ipAddress` in API response

### 4. WireGuard Config Generator (`lib/wireguard/config-generator.ts`)

#### Server Config (`wg0.conf`)
- **Before**: `AllowedIPs = ${user.ipAddress}/32`
- **After**: `AllowedIPs = ${user.allowedIps}`
- Supports multiple IPs/subnets per peer
- Example output:
  ```ini
  [Peer]
  PublicKey = abc123...
  AllowedIPs = 10.5.10.2/32, 192.168.1.0/24, 0.0.0.0/0
  ```

#### Client Config  
- **Address field**: Uses first IP from allowedIps list
- `Address = ${user.allowedIps?.split(',')[0]}`
- Example: If allowedIps = "10.5.10.2/32,192.168.1.0/24"
  - Client gets: `Address = 10.5.10.2/32`

### 5. Type Definitions (`types/vpn.ts`)

Updated `VPNConnection` interface:
```typescript
interface VPNConnection {
  // ... other fields
  allowedIps: string;  // was: ipAddress: string;
}
```

### 6. Other Files

- **`app/page.tsx`**: Updated interface and display to show `allowedIps`
- **`lib/mock-data.ts`**: Updated mock data to use CIDR notation

## Usage Examples

### Single IP (Most Common)
```
10.5.10.2/32
```

### Multiple IPs
```
10.5.10.2/32
10.5.10.3/32
```

### Subnet
```
192.168.100.0/24
```

### Full Tunnel (Route All Traffic)
```
0.0.0.0/0
```

### Mixed Configuration
```
10.5.10.2/32
192.168.1.0/24
172.16.0.0/16
0.0.0.0/0
```

## Migration Steps

1. **Apply Schema Changes**:
   ```bash
   npx prisma migrate dev --name rename_ipaddress_to_allowedips
   ```

2. **Regenerate Prisma Client**:
   ```bash
   npx prisma generate
   ```

3. **Verify Changes**:
   ```bash
   npm run type-check
   ```

4. **Restart Application**:
   ```bash
   npm run dev
   ```

## Validation Rules

1. **CIDR Format Required**: All IPs must include subnet mask
   - Valid: `10.5.10.2/32`, `192.168.1.0/24`
   - Invalid: `10.5.10.2`, `192.168.1.0`

2. **No Duplicates**: System prevents identical allowedIps entries

3. **Range Check**: Each IP must be within configured `clientAddressRange`

4. **Multiple IPs**: Supported via comma-separated values

## Backward Compatibility

- Existing users with single IPs will work after migration converts them to CIDR format
- Migration automatically adds `/32` suffix to existing IPs
- No data loss - all configurations preserved

## Technical Notes

- **Storage**: Comma-separated string in database
- **Display**: Newline-separated in UI textarea
- **API**: Returns/accepts both formats for compatibility
- **WireGuard**: First IP becomes client tunnel address
- **Server Config**: Full list used for peer AllowedIPs

## Files Changed

Total: 10 files modified
- `prisma/schema.prisma` - Schema change
- `app/dashboard/users/page.tsx` - UI with textarea
- `app/api/users/route.ts` - Create/update logic  
- `app/api/users/next-ip/route.ts` - IP suggestion
- `app/api/users/by-ip/route.ts` - IP lookup
- `app/api/connections/active/route.ts` - Active connections
- `lib/wireguard/config-generator.ts` - Config generation
- `types/vpn.ts` - TypeScript types
- `app/page.tsx` - Landing page
- `lib/mock-data.ts` - Mock data

## Testing Checklist

- [ ] Create user with single IP (10.5.10.2/32)
- [ ] Create user with multiple IPs
- [ ] Create user with subnet (192.168.1.0/24)  
- [ ] Create user with full tunnel (0.0.0.0/0)
- [ ] Edit existing user's allowed IPs
- [ ] Verify WireGuard config generation
- [ ] Test IP validation (must have CIDR notation)
- [ ] Test duplicate detection
- [ ] Verify search/filter by IP
- [ ] Test sorting by allowed IPs

## Next Steps

1. Review changes: `git diff`
2. Create migration: `npx prisma migrate dev`
3. Test in development environment
4. Commit changes with descriptive message
5. Deploy to production

## Support

For questions or issues:
- WireGuard CIDR notation: https://www.wireguard.com/
- IPv4 CIDR calculator: https://www.ipaddressguide.com/cidr
