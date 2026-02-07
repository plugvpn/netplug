# Migration to SQLite & Edge Runtime Fixes

## Summary

Successfully migrated the NetPlug VPN Dashboard from PostgreSQL to SQLite and fixed Edge Runtime compatibility issues with Next.js middleware.

## Changes Made

### 1. Database Migration (PostgreSQL → SQLite)

**Why**: SQLite is lighter weight, requires no external database server, and is perfect for a VPN dashboard use case.

**Files Modified:**
- `prisma/schema.prisma` - Changed datasource from `postgresql` to `sqlite`
- `.env` - Updated DATABASE_URL from PostgreSQL connection string to `file:./dev.db`
- `.env.example` - Updated template for SQLite
- `package.json` - Downgraded to Prisma 6 for stability (from Prisma 7 beta)

**Benefits:**
- No external database installation required
- Zero configuration database setup
- Lightweight and fast
- Perfect for single-server deployments
- Easy backups (just copy the .db file)

### 2. Edge Runtime Compatibility Fix

**Problem**: Next.js middleware runs on Edge Runtime, which doesn't support Prisma database connections. The original middleware was trying to call `getSetupStatus()` which uses Prisma, causing this error:

```
Error [PrismaClientValidationError]: In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate
- Use Driver Adapters
```

**Solution**: Refactored middleware to use cookies instead of database calls.

**How It Works:**

1. **Middleware** (`middleware.ts`):
   - Checks `setup-complete` cookie (not database)
   - Checks NextAuth session cookie (not database)
   - Edge-compatible, fast, no database queries

2. **Setup Completion** (`/api/setup/vpn-config`):
   - When setup completes, sets `setup-complete` cookie
   - Cookie is httpOnly, secure, lasts 1 year

3. **Fallback Check** (`app/page.tsx`):
   - Root page checks database if cookie is missing
   - Redirects to `/api/setup/verify` to set cookie
   - Ensures cookie and database stay in sync

4. **Verification Route** (`/api/setup/verify`):
   - Checks database for setup status
   - Sets cookie if setup is complete
   - Redirects to dashboard

**Files Modified:**
- `middleware.ts` - Removed Prisma imports, use cookie-based checks
- `app/api/setup/vpn-config/route.ts` - Added cookie setting on setup completion
- `app/page.tsx` - Added server-side setup verification
- `app/api/setup/verify/route.ts` - New route for cookie synchronization
- `app/setup/layout.tsx` - Added server-side check to prevent accessing setup after completion

### 3. Documentation Updates

**Files Updated:**
- `README.md` - Updated with SQLite info, removed PostgreSQL requirements
- `docs/SETUP.md` - Complete rewrite for SQLite setup process
- `docs/IMPLEMENTATION_SUMMARY.md` - Updated to reflect SQLite and edge runtime changes
- `.env.example` - New template with SQLite configuration

## Architecture

### Before (PostgreSQL + Database Middleware)

```
Request → Middleware → Database Query (❌ Not Edge Compatible)
                    ↓
              Check Setup Status
                    ↓
              Check Auth Session
                    ↓
              Redirect Logic
```

### After (SQLite + Cookie Middleware)

```
Request → Middleware → Read Cookies (✅ Edge Compatible)
                    ↓
              Check setup-complete cookie
                    ↓
              Check session cookie
                    ↓
              Redirect Logic

Setup Completion → API Route → Database Update + Set Cookie
Root Page → Check Database → Set Cookie if Missing (Fallback)
```

## Testing Checklist

- [x] SQLite database created successfully
- [x] Prisma migrations run without errors
- [x] Middleware doesn't call database (Edge compatible)
- [x] Setup wizard completes and sets cookie
- [x] Cookie persists across sessions
- [x] Fallback cookie setting works when cookie is missing
- [x] Authentication flow works with session cookies
- [x] Setup wizard prevents access after completion

## Migration Instructions for Existing Installations

If you have an existing installation with PostgreSQL:

1. **Backup your data:**
   ```bash
   npx prisma studio  # Export your data manually
   ```

2. **Update Prisma schema:**
   ```bash
   # Already updated in the repository
   git pull
   ```

3. **Delete old database and migrations:**
   ```bash
   rm -rf prisma/migrations
   ```

4. **Update .env:**
   ```bash
   DATABASE_URL="file:./dev.db"
   ```

5. **Run new migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

6. **Re-run setup wizard:**
   ```bash
   # Delete the old database
   rm dev.db

   # Restart the app
   npm run dev

   # Access http://localhost:3000 and complete setup
   ```

## File Structure Changes

```
New Files:
+ app/api/setup/verify/route.ts         # Cookie synchronization route
+ docs/MIGRATION_TO_SQLITE.md          # This document

Modified Files:
~ middleware.ts                         # Edge-compatible cookie checks
~ app/page.tsx                          # Server-side setup verification
~ app/api/setup/vpn-config/route.ts    # Set cookie on completion
~ app/setup/layout.tsx                  # Server-side access control
~ prisma/schema.prisma                  # SQLite datasource
~ .env                                  # SQLite connection string
~ .env.example                          # Updated template
~ README.md                             # SQLite documentation
~ docs/SETUP.md                         # Updated setup guide
~ docs/IMPLEMENTATION_SUMMARY.md       # Updated with changes
~ .gitignore                            # Ignore .db files

Removed Files:
- prisma/prisma.config.ts              # Not needed in Prisma 6
```

## Performance Impact

### Positive:
- ✅ **Faster middleware**: Cookie checks are instant vs database queries
- ✅ **No network overhead**: File-based database on same server
- ✅ **Better caching**: Browser handles cookie caching automatically
- ✅ **Reduced latency**: Edge runtime is globally distributed

### Considerations:
- SQLite is single-writer (fine for VPN dashboard - mostly reads)
- Database file needs regular backups (simple: just copy the file)
- Not suitable for massive scale (but perfect for VPN use case)

## Security Notes

1. **Cookie Security:**
   - `httpOnly: true` - Not accessible via JavaScript
   - `secure: true` in production - HTTPS only
   - `sameSite: 'lax'` - CSRF protection
   - `maxAge: 1 year` - Persistent across sessions

2. **Database Security:**
   - Set proper file permissions: `chmod 600 dev.db`
   - Add to `.gitignore` (already done)
   - Regular backups recommended
   - Keep in secure location with restricted access

3. **No Breaking Changes:**
   - All authentication logic unchanged
   - Password hashing still uses bcrypt
   - Sessions still use NextAuth JWT
   - Setup wizard flow identical

## Rollback Plan

If you need to rollback to PostgreSQL:

1. Restore from backup
2. Revert `prisma/schema.prisma` datasource to `postgresql`
3. Update `.env` with PostgreSQL connection string
4. Revert middleware.ts to use database checks (not recommended for Edge)
5. Run migrations: `npx prisma migrate dev`

Note: Rollback not recommended due to Edge runtime incompatibility.

## Conclusion

The migration to SQLite and cookie-based middleware checks makes the application:
- ✅ Simpler to deploy (no external database)
- ✅ Edge runtime compatible (faster, globally distributed)
- ✅ Easier to maintain (fewer moving parts)
- ✅ Better performance (reduced latency)
- ✅ More portable (single .db file for data)

Perfect for self-hosted VPN dashboard deployments!
