# Sync Intervals and Timing

## Overview

The system uses a two-tier refresh strategy:
1. **Background sync**: WireGuard → Database (every 30 seconds)
2. **Dashboard refresh**: Database → UI (every 15 seconds)

## Why This Architecture?

### Separation of Concerns

**Write Path (Background)**:
- Runs independently in server process
- Single thread updates database
- No user impact on performance
- Consistent sync interval

**Read Path (Frontend)**:
- Multiple users can query simultaneously
- Fast database queries (5-20ms)
- No WireGuard commands during requests
- Scales with user count

### Performance Benefits

1. **No Command Spam**: Only 1 `wg show` command per 30 seconds (vs per request)
2. **Fast APIs**: Database queries are 10-100x faster than WireGuard commands
3. **Scalable**: 100 users querying doesn't slow down sync
4. **Predictable**: Consistent performance regardless of user count

## Timing Details

### Background Sync: 30 Seconds

**Why 30 seconds?**
- Balance between freshness and system load
- WireGuard handshakes typically every 25 seconds (default keepalive)
- Captures connection changes quickly
- Low system overhead (~0.33% CPU time)

**What happens**:
```javascript
Every 30 seconds:
  1. Run `wg show wg0 dump`        (~50ms)
  2. Parse peer data               (~10ms)
  3. Update database (N users)     (~20ms × N)
  4. Log results                   (~5ms)
Total: ~100-200ms depending on user count
```

**Can be adjusted**:
```typescript
// In lib/startup.ts
startWireGuardSyncService('wg0', 30000) // milliseconds

// Change to 60s for less frequent updates:
startWireGuardSyncService('wg0', 60000)

// Or 15s for more frequent updates:
startWireGuardSyncService('wg0', 15000)
```

### Dashboard Refresh: 15 Seconds

**Why 15 seconds?**
- Feels near real-time to users
- Max data staleness: 15 seconds
- Reasonable network traffic
- 2:1 ratio with sync (always gets recent data)

**What happens**:
```javascript
Every 15 seconds:
  1. Fetch from API endpoints      (~50-100ms network)
  2. Query database                (~5-20ms)
  3. Return JSON                   (~5ms)
  4. Update UI                     (~10ms)
Total: ~70-135ms per refresh
```

**User Experience**:
- Active connections update every 15s
- Connection counts update every 15s
- Data transfer stats update every 15s
- Manual refresh button for immediate update

## Timeline Example

```
Second 0:   ┌─ Background Sync ─────────────────┐
            │ • wg show dump                    │
            │ • Update database                 │
            └───────────────────────────────────┘

Second 15:  Dashboard refreshes (gets data from DB)

Second 30:  ┌─ Background Sync ─────────────────┐
            │ • wg show dump                    │
            │ • Update database                 │
            └───────────────────────────────────┘

Second 45:  Dashboard refreshes (gets data from DB)

Second 60:  ┌─ Background Sync ─────────────────┐
            │ • wg show dump                    │
            │ • Update database                 │
            └───────────────────────────────────┘
```

## Data Freshness

### Maximum Staleness

**Dashboard data is at most 15 seconds old**:
- Worst case: Sync happens at 0s, dashboard reads at 14s
- Best case: Sync happens at 0s, dashboard reads at 1s
- Average: ~7.5 seconds stale

**Connection status is at most 30 seconds behind WireGuard**:
- Sync happens every 30s
- Status reflects handshake at time of sync
- With 75s timeout (25s keepalive × 3), this is acceptable

### Acceptable Lag?

**Yes, because**:
1. VPN connections are long-lived (minutes to hours)
2. Handshakes happen every 25s (keepalive)
3. 30s sync captures all connection changes
4. Users don't notice 15s UI refresh delay

**Compare to alternatives**:
- Real-time WebSocket: Complex, overkill for VPN monitoring
- 5s refresh: 3x network traffic, minimal benefit
- Per-request WireGuard query: Slow (100ms), doesn't scale

## Monitoring Sync Health

### Check Last Sync Time

```bash
curl http://localhost:3000/api/sync/info | jq
```

Response:
```json
{
  "lastSync": "2024-02-08T10:30:15.000Z",
  "status": "success",
  "error": null,
  "syncInterval": "30 seconds",
  "dashboardRefresh": "15 seconds",
  "timeSinceLastSync": 12
}
```

### Watch Sync Logs

```bash
tail -f logs/app.log | grep WireGuard

# Output every 30 seconds:
[WireGuard] Using timeout: 75s (25s keepalive × 3)
[WireGuard] user1: ONLINE (handshake 12s ago, rx=1234567890, tx=9876543210)
[WireGuard] user2: ONLINE (handshake 8s ago, rx=555444333, tx=222333444)
[WireGuard] Sync complete: 2 online, 0 offline
```

## Adjusting Intervals

### Make Dashboard Refresh Faster (10s)

**File**: `app/dashboard/page.tsx`

```typescript
// Change from:
const interval = setInterval(fetchData, 15000);

// To:
const interval = setInterval(fetchData, 10000);
```

**File**: `components/active-connections-table.tsx`

```typescript
// Change from:
const interval = setInterval(fetchConnections, 15000);

// To:
const interval = setInterval(fetchConnections, 10000);
```

### Make Background Sync Faster (15s)

**File**: `lib/startup.ts`

```typescript
// Change from:
wireGuardSyncInterval = startWireGuardSyncService('wg0', 30000);

// To:
wireGuardSyncInterval = startWireGuardSyncService('wg0', 15000);
```

**Trade-off**: More CPU usage, more frequent database writes

### Make Background Sync Slower (60s)

**File**: `lib/startup.ts`

```typescript
// Change from:
wireGuardSyncInterval = startWireGuardSyncService('wg0', 30000);

// To:
wireGuardSyncInterval = startWireGuardSyncService('wg0', 60000);
```

**Trade-off**: Less CPU usage, but slower to detect disconnections

## Recommended Configurations

### Default (Balanced)
```
Background Sync: 30 seconds
Dashboard Refresh: 15 seconds

Good for: Most deployments
CPU Impact: Minimal
User Experience: Near real-time
```

### High Frequency (Real-time feel)
```
Background Sync: 15 seconds
Dashboard Refresh: 10 seconds

Good for: Small deployments, demos
CPU Impact: Low (2x default)
User Experience: Very responsive
```

### Low Frequency (Resource constrained)
```
Background Sync: 60 seconds
Dashboard Refresh: 30 seconds

Good for: Many users, limited resources
CPU Impact: Minimal (0.5x default)
User Experience: Acceptable delay
```

### Production (Many users)
```
Background Sync: 30 seconds
Dashboard Refresh: 20 seconds

Good for: Production with many concurrent dashboards
CPU Impact: Minimal
User Experience: Good balance
```

## Performance Impact

### Background Sync

**30 second interval**:
- 2 syncs per minute
- ~200ms per sync
- 400ms total per minute
- **0.67% CPU time** (400ms / 60,000ms)

**15 second interval**:
- 4 syncs per minute
- ~200ms per sync
- 800ms total per minute
- **1.33% CPU time** (800ms / 60,000ms)

### Dashboard Refresh

**Per user impact**:
- Database query: ~10ms
- Network transfer: ~50ms
- Total: ~60ms per refresh

**100 users refreshing every 15s**:
- 100 × 60ms = 6,000ms per 15 seconds
- 24,000ms per minute (at full concurrency)
- ~40% CPU if all users refresh simultaneously
- **Reality**: Requests are spread out, actual load ~5-10%

## Summary

✅ **30s sync + 15s refresh** is optimal for most deployments

✅ **Fast enough**: Users perceive as real-time

✅ **Efficient**: Minimal system load

✅ **Scalable**: Database queries handle many users

✅ **Adjustable**: Easy to tune for your needs

✅ **Monitored**: API endpoint shows sync health
