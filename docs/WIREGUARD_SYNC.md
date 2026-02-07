# WireGuard Data Synchronization

This document explains how WireGuard peer data is synchronized between the WireGuard interface and the database.

## Overview

The system continuously syncs WireGuard peer status to the database for:
- Historical usage tracking
- Connection statistics
- Real-time monitoring
- Data transfer analytics

## Online/Offline Detection

### How It Works

A peer is considered **ONLINE** if:
1. It has a valid handshake (`latestHandshake > 0`)
2. The handshake age is less than `persistent_keepalive × 3` seconds

A peer is considered **OFFLINE** if:
- Handshake age exceeds the timeout
- Not found in `wg show dump` output

### Timeout Calculation

```
timeout = persistent_keepalive × 3
```

**Example:**
- If `persistent_keepalive = 25` seconds (default)
- Timeout = 25 × 3 = 75 seconds
- User is online if last handshake was within 75 seconds

**Why 3x multiplier?**
- Network packets can be delayed
- Temporary network issues shouldn't mark users offline
- More lenient than 1x keepalive (which would be too strict)

### Configuration

The `persistent_keepalive` value comes from your WireGuard configuration:

```json
{
  "wireGuard": {
    "persistentKeepalive": 25,
    // ... other settings
  }
}
```

Default value: 25 seconds (if not configured)

## Sync Process

### Background Sync Service

Runs every 30 seconds (configurable):

```typescript
startWireGuardSyncService('wg0', 30000) // 30 seconds
```

### What Gets Synced

For each peer found in `wg show dump`:

1. **Connection Status**: Online/Offline based on handshake age
2. **Data Transfer**:
   - `bytesReceived` (RX) - Downloaded
   - `bytesSent` (TX) - Uploaded
3. **Connection Timestamp**: `connectedAt` - When user first connected
4. **Last Update**: Database record updated with current values

### Sync Flow

```
Every 30 seconds:
    ↓
Run `wg show wg0 dump`
    ↓
Parse peer data:
  - Public key
  - Latest handshake timestamp
  - Transfer RX/TX bytes
  - Endpoint
    ↓
For each database user:
  - Find matching peer by public key
  - Calculate handshake age
  - Determine if online/offline
  - Update database:
    * isConnected (boolean)
    * bytesReceived (bigint)
    * bytesSent (bigint)
    * connectedAt (timestamp)
    ↓
Log results:
  "Sync complete: X online, Y offline"
```

## Database Schema

```prisma
model VPNUser {
  id              String    @id @default(cuid())
  username        String    @unique
  publicKey       String?   // WireGuard client public key

  // Synced from WireGuard
  isConnected     Boolean   @default(false)
  connectedAt     DateTime?
  bytesReceived   BigInt    @default(0)
  bytesSent       BigInt    @default(0)

  // ...other fields
}
```

## API Endpoints (Query Database Only)

All API endpoints query the database for fast response times:

### `/api/connections/active`
- Queries database for users with `isConnected = true`
- Returns currently connected users
- Shows transfer statistics from last sync

### `/api/connections/stats`
- Gets connection counts from database (in use, available, total)
- Uses synced connection status

### `/api/connections/data-transfer`
- Aggregates total and active transfer data from database
- Fast aggregation queries

## Data Flow

### Background Sync (Write Path)
```
WireGuard Interface (utun8/wg0)
    ↓ [wg show dump - every 30s]
Background Sync Service
    ↓ [parse + calculate]
Update Database
  - isConnected (online/offline)
  - bytesReceived
  - bytesSent
  - connectedAt
```

### Dashboard Queries (Read Path)
```
Dashboard UI
    ↓ [every 15s]
API Endpoints
    ↓ [fast SQL queries]
Database (SQLite)
    ↓
Return to UI
```

### Benefits of This Architecture
✅ **Fast API responses** - Database queries are milliseconds
✅ **No WireGuard command spam** - Background thread runs once every 30s
✅ **Scalable** - Multiple users don't slow down the system
✅ **Clean separation** - Write (sync) and Read (API) are independent
✅ **Historical data** - Database stores all data for analytics

## Historical Data

The database stores:
- **Cumulative totals**: Total bytes ever transferred
- **Current status**: Online/offline state
- **Connection timestamps**: When users connect

This allows for:
- Usage reports
- Bandwidth analytics
- Connection history
- User activity tracking

## Logging

Sync process logs detailed information:

```
[WireGuard] Using timeout: 75s (25s keepalive × 3)
[WireGuard] user1: ONLINE (handshake 12s ago, rx=1234567890, tx=9876543210)
[WireGuard] user2: OFFLINE (handshake 120s ago, exceeds 75s timeout)
[WireGuard] user3: OFFLINE (not in wg status)
[WireGuard] Sync complete: 1 online, 2 offline
```

## Performance Considerations

### Sync Interval
- Default: 30 seconds
- Can be adjusted based on needs
- More frequent = more real-time, more system load
- Less frequent = less load, slightly delayed status

### Database Writes
- Only updates changed values
- Minimizes write operations
- Uses indexed lookups (publicKey)

### WireGuard Command
- `wg show dump` is fast (milliseconds)
- Minimal impact on WireGuard performance
- Safe to run frequently

## Monitoring

### Check Sync Configuration

```bash
# Get sync settings and timeout calculation
curl http://localhost:3000/api/wireguard/sync | jq
```

Response:
```json
{
  "syncInterval": "30 seconds",
  "persistentKeepalive": "25 seconds",
  "timeoutThreshold": "75 seconds (25s × 3)",
  "calculation": {
    "keepalive": 25,
    "multiplier": 3,
    "timeout": 75
  }
}
```

### Manual Sync Trigger

```bash
# Force immediate sync (useful for testing)
curl -X POST http://localhost:3000/api/wireguard/sync
```

### View Sync Logs

```bash
# View logs in real-time
tail -f logs/app.log | grep WireGuard

# Or check console output
npm run dev
# Watch for sync messages every 30 seconds
```

### Check WireGuard Status

```bash
# Get current WireGuard interface status
curl http://localhost:3000/api/wireguard/status | jq
```

## Troubleshooting

### Users show as offline despite being connected

1. Check persistent_keepalive value:
   ```bash
   wg show wg0
   ```
   Look for `persistent keepalive` in peer config

2. Verify handshakes are happening:
   ```bash
   wg show wg0 dump
   ```
   Check `latest-handshake` column (should update regularly)

3. Check sync logs for timeout calculation

### Data not syncing

1. Verify background service is running:
   - Check startup logs for "Starting sync service"

2. Check permissions:
   - Must run with sudo/root to read WireGuard data
   - See [PERMISSIONS.md](PERMISSIONS.md)

3. Check WireGuard interface exists:
   ```bash
   wg show interfaces
   ```

## Configuration Examples

### Standard Config (25s keepalive)
```json
{
  "wireGuard": {
    "persistentKeepalive": 25
  }
}
```
- Timeout: 75 seconds
- Good for: Most deployments

### Mobile Users (15s keepalive)
```json
{
  "wireGuard": {
    "persistentKeepalive": 15
  }
}
```
- Timeout: 45 seconds
- Good for: Users with mobile data connections
- Faster offline detection

### Low Bandwidth (60s keepalive)
```json
{
  "wireGuard": {
    "persistentKeepalive": 60
  }
}
```
- Timeout: 180 seconds (3 minutes)
- Good for: Reducing bandwidth from keepalives
- Slower offline detection

## Summary

✅ Automatic sync every 30 seconds
✅ Uses `persistent_keepalive × 3` for timeout
✅ Stores all data in database for history
✅ Real-time API endpoints always fetch fresh data
✅ Handles connection/disconnection gracefully
✅ Detailed logging for troubleshooting
