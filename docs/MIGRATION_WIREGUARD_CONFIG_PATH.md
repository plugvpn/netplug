# WireGuard Config Path Migration

## Overview

This migration updates the WireGuard configuration file path from the hardcoded `/etc/wireguard/wg0.conf` to use the `DATA_DIR` environment variable: `$DATA_DIR/wg0.conf`.

## Changes Made

### 1. API Routes Updated
All API routes now dynamically construct the config path using `path.join(process.env.DATA_DIR || '/data', 'wg0.conf')`:

- `app/api/servers/route.ts` - Server creation and listing
- `app/api/servers/[id]/route.ts` - Server updates
- `app/api/setup/vpn-config/route.ts` - Setup configuration
- `app/api/wireguard/route.ts` - WireGuard config endpoint

### 2. Dynamic Path Override
API endpoints now override the `configPath` field when returning server data to always show the correct DATA_DIR-based path, even if the database has old values.

### 3. Frontend Updates
- `app/dashboard/servers/page.tsx` - Updated placeholders and fallback data to use `$DATA_DIR/wg0.conf`

### 4. Documentation Updates
- `docs/SETUP.md` - Updated setup instructions
- `docs/IMPLEMENTATION_SUMMARY.md` - Updated configuration examples

## Migration Script

A migration script is provided to update existing database records:

```bash
# Set DATA_DIR environment variable (if not already set)
export DATA_DIR=/path/to/your/data

# Run the migration
npx ts-node scripts/migrate-wireguard-config-path.ts
```

### What the Script Does

1. Reads the `DATA_DIR` environment variable
2. Constructs the new config path: `$DATA_DIR/wg0.conf`
3. Finds the WireGuard VPNServer record in the database
4. Updates the `configPath` field if it differs from the new path
5. Reports the changes made

## Manual Migration (Alternative)

If you prefer to update manually, you can run this SQL:

```sql
-- Replace '/data' with your actual DATA_DIR value
UPDATE "VPNServer"
SET "configPath" = '/data/wg0.conf'
WHERE id = 'wireguard';
```

## Verification

After migration, verify the changes:

1. Navigate to the WireGuard Configuration page in the dashboard
2. Check that "Config Path" shows `$DATA_DIR/wg0.conf` (or the actual path if DATA_DIR is set)
3. Navigate to the Servers page
4. Verify the WireGuard server shows the correct config path

## Backward Compatibility

- The dynamic override in API endpoints ensures the correct path is always shown, even if the database has old values
- New server records will automatically use the DATA_DIR-based path
- Existing deployments will continue to work without requiring immediate migration

## Environment Variables

Ensure `DATA_DIR` is set in your environment:

```bash
# .env or docker-compose.yml
DATA_DIR=/path/to/wireguard/data
```

Default fallback if not set: `/data`
