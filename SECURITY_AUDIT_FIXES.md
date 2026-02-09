# Security Audit Fixes - API Authentication

## Summary
All sensitive API endpoints have been secured with authentication to prevent unauthorized access to private keys, user data, and system information.

## Endpoints Secured

### ✅ CRITICAL - Private Key Protection

1. **`/api/users` (GET, POST)**
   - Now requires authentication
   - Server private keys removed from response
   - User private/public/preshared keys still returned to authenticated admins only

2. **`/api/users/[id]` (PATCH, DELETE)**
   - Now requires authentication
   - User management restricted to authenticated users

3. **`/api/servers` (GET)**
   - Now requires authentication
   - **Server private keys removed from response** (CRITICAL FIX)
   - Public keys still available for configuration

4. **`/api/wireguard` (GET, PUT)**
   - Now requires authentication
   - **Server private keys removed from response** (CRITICAL FIX)

### ✅ HIGH - System Information Protection

5. **`/api/system/info` (GET)**
   - Now requires authentication
   - Prevents disclosure of: server IP, hostname, OS details

6. **`/api/activity-logs` (GET, DELETE)**
   - Now requires authentication
   - Prevents log disclosure and unauthorized deletion

7. **`/api/wireguard/diagnostics` (GET)**
   - Now requires authentication
   - Prevents configuration and interface details disclosure

### ✅ MEDIUM - Operation Protection

8. **`/api/wireguard/status` (GET)**
   - Now requires authentication

9. **`/api/wireguard/reload` (POST)**
   - Now requires authentication

10. **`/api/wireguard/restart` (POST)**
    - Now requires authentication

11. **`/api/wireguard/sync` (POST)**
    - Now requires authentication

12. **`/api/connections` (GET, DELETE)**
    - Now requires authentication

## Public Endpoints (Intentionally Unsecured)

These endpoints remain public for legitimate reasons:

- **`/api/auth/*`** - Authentication endpoints (must be public)
- **`/api/users/by-ip`** - Public status page (sanitized data only)
- **`/api/setup/*`** - Setup wizard (protected by setup completion check)

## Authentication Method

All secured endpoints use the `requireAuth()` helper from `/lib/api-auth.ts`:

```typescript
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return authResult.error; // Returns 401 Unauthorized
  }
  // ... rest of endpoint code
}
```

## What Was NOT Fixed (Future Work)

1. **User private keys still returned to authenticated users** - Consider encrypting at rest
2. **Setup endpoints** - Should be further locked down after initial setup
3. **Rate limiting** - Not implemented
4. **Request logging** - Not implemented for sensitive operations
5. **IP-based access controls** - Not implemented

## Testing

After these changes, unauthenticated requests to sensitive endpoints will receive:

```json
{
  "error": "Unauthorized. Please login to access this resource."
}
```

HTTP Status: **401 Unauthorized**

## Impact

- ✅ Prevents private key theft
- ✅ Prevents user enumeration
- ✅ Prevents system information disclosure
- ✅ Prevents unauthorized operations
- ⚠️ Existing authenticated admins can still access all data (as intended)

## Date
February 9, 2026
