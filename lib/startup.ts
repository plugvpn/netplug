import { initializeWireGuard, startWireGuardSyncService, bringDownWireGuard } from './wireguard/sync-service';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';
import { mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { prisma } from './prisma';
import { hashPassword } from './password';
import { randomBytes } from 'crypto';

// Global reference to WireGuard sync interval
let wireGuardSyncInterval: NodeJS.Timeout | null = null;

// Track if cleanup has been executed
let cleanupExecuted = false;

/** Local prisma/sandbox DB is treated as disposable; see P3005 handling below. */
function isDisposableSandboxDatabasePath(dbPath: string): boolean {
  const normalized = dbPath.replace(/\\/g, '/');
  return normalized.includes('/prisma/sandbox/');
}

/**
 * Production images may put a full Prisma CLI on PATH (e.g. /opt/prisma-migrate); the
 * Next.js standalone bundle can ship an incomplete `node_modules/prisma`, so prefer PATH.
 */
function prismaMigrateCommand(): string {
  try {
    if (process.platform === 'win32') {
      execSync('where prisma', { stdio: 'ignore', env: process.env });
    } else {
      execSync('command -v prisma', { stdio: 'ignore', env: process.env });
    }
    return 'prisma migrate deploy';
  } catch {
    const prismaCli = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
    if (existsSync(prismaCli)) {
      return `node "${prismaCli}" migrate deploy`;
    }
    return 'npx prisma migrate deploy';
  }
}

/**
 * Ensure the SQLite file parent directory exists and apply migrations.
 * Runs on every server start so the DB schema always matches the codebase.
 */
async function initializeDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('[Startup] DATABASE_URL environment variable is not set');
    return false;
  }

  // Parse the database file path from DATABASE_URL
  // Format: "file:../sandbox/data/prod.db" or "file:./dev.db"
  const fileMatch = databaseUrl.match(/^file:(.+)$/);
  if (!fileMatch) {
    console.error('[Startup] Invalid DATABASE_URL format');
    return false;
  }

  // Resolve path the same way Prisma does: relative to the prisma/ directory
  const prismaDir = resolve(process.cwd(), 'prisma');
  const dbPath = resolve(prismaDir, fileMatch[1]);

  console.log(`[Startup] Database file: ${dbPath}`);

  try {
    const dbDir = dirname(dbPath);
    await mkdir(dbDir, { recursive: true });

    console.log('[Startup] Applying Prisma migrations...');

    const migrateCmd = prismaMigrateCommand();

    const maxMigrateAttempts = 2;
    for (let attempt = 0; attempt < maxMigrateAttempts; attempt++) {
      try {
        const stdout = execSync(migrateCmd, {
          cwd: process.cwd(),
          encoding: 'utf-8',
          env: process.env,
          stdio: ['inherit', 'pipe', 'pipe'],
        });
        if (stdout) {
          process.stdout.write(stdout);
        }
        break;
      } catch (migrateError: unknown) {
        const err = migrateError as { stderr?: string; stdout?: string };
        const combined = `${err.stderr ?? ''}${err.stdout ?? ''}`;
        const isP3005 = combined.includes('P3005');

        if (
          isP3005 &&
          isDisposableSandboxDatabasePath(dbPath) &&
          existsSync(dbPath) &&
          attempt < maxMigrateAttempts - 1
        ) {
          console.warn(
            '[Startup] Database has tables but no Prisma migration history (P3005). ' +
              'Removing disposable prisma/sandbox database once so migrations can apply.'
          );
          unlinkSync(dbPath);
          continue;
        }

        console.error('[Startup] Failed to apply database migrations:', migrateError);
        if (isP3005 && !isDisposableSandboxDatabasePath(dbPath)) {
          console.error(
            '[Startup] Baseline or reset this database, then run `npx prisma migrate deploy`. ' +
              'See https://www.prisma.io/docs/guides/migrate/production-troubleshooting'
          );
        }
        return false;
      }
    }

    console.log('[Startup] ✓ Database schema is up to date');
    return true;
  } catch (error) {
    console.error('[Startup] Failed to apply database migrations:', error);
    return false;
  }
}

/**
 * Generate a random password
 */
function generatePassword(length: number = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  const password = randomBytes(length)
    .toString('base64')
    .slice(0, length)
    .split('')
    .map((_, i) => chars[randomBytes(1)[0] % chars.length])
    .join('');
  return password;
}

/**
 * Create default admin user if none exists
 */
async function ensureAdminExists() {
  try {
    // Check if any admin user exists
    const adminCount = await prisma.user.count({
      where: { role: 'admin' },
    });

    if (adminCount > 0) {
      console.log('[Startup] ✓ Admin user already exists');
      return;
    }

    console.log('[Startup] No admin user found, creating default admin...');

    // Generate random password
    const username = 'admin';
    const password = generatePassword(16);
    const hashedPassword = await hashPassword(password);

    // Create admin user
    await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: 'admin',
      },
    });

    // Display credentials prominently in the logs
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  DEFAULT ADMIN CREDENTIALS CREATED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('  Username: ' + username);
    console.log('  Password: ' + password);
    console.log('');
    console.log('  ⚠️  IMPORTANT: Save these credentials securely!');
    console.log('  ⚠️  Change the password after first login!');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n');
  } catch (error) {
    console.error('[Startup] Failed to create admin user:', error);
  }
}

/**
 * Cleanup function to run when the server stops
 */
async function cleanup() {
  if (cleanupExecuted) {
    return;
  }
  cleanupExecuted = true;

  console.log('\n[Shutdown] Cleaning up...');

  try {
    // Stop sync service
    if (wireGuardSyncInterval) {
      clearInterval(wireGuardSyncInterval);
      wireGuardSyncInterval = null;
      console.log('[Shutdown] ✓ Stopped WireGuard sync service');
    }

    // Bring down WireGuard interface
    console.log('[Shutdown] Bringing down WireGuard interface...');
    const success = await bringDownWireGuard('wg0');
    if (success) {
      console.log('[Shutdown] ✓ WireGuard interface brought down');
    }

    // Disconnect Prisma
    await prisma.$disconnect();
    console.log('[Shutdown] ✓ Database disconnected');
  } catch (error) {
    console.error('[Shutdown] Error during cleanup:', error);
  }

  console.log('[Shutdown] Cleanup completed\n');
}

/**
 * Run startup tasks when the server starts
 */
export async function runStartupTasks() {
  console.log('=================================');
  console.log('Running startup tasks...');
  console.log('=================================');

  try {
    // Initialize database if needed
    console.log('[Startup] Initializing database...');
    const dbInitialized = await initializeDatabase();

    if (!dbInitialized) {
      console.error('[Startup] ⚠ Failed to initialize database');
      // Don't continue with other tasks if database initialization failed
      return;
    }

    // Ensure admin user exists
    console.log('[Startup] Checking admin user...');
    await ensureAdminExists();

    // Initialize WireGuard
    console.log('[Startup] Initializing WireGuard...');
    await initializeWireGuard('wg0');

    // Start WireGuard sync service
    if (wireGuardSyncInterval) {
      clearInterval(wireGuardSyncInterval);
    }
    const rawInterval = parseInt(process.env.WIREGUARD_SYNC_INTERVAL_MS || '30000', 10);
    const syncIntervalMs = Number.isFinite(rawInterval)
      ? Math.min(Math.max(rawInterval, 5000), 86_400_000)
      : 30_000;
    wireGuardSyncInterval = startWireGuardSyncService('wg0', syncIntervalMs);

    // Register cleanup handlers
    process.on('SIGINT', async () => {
      console.log('\n[Shutdown] Received SIGINT (Ctrl+C)');
      await cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n[Shutdown] Received SIGTERM');
      await cleanup();
      process.exit(0);
    });

    process.on('beforeExit', async () => {
      await cleanup();
    });
  } catch (error) {
    console.error('[Startup] Error during startup tasks:', error);
  }

  console.log('=================================');
  console.log('Startup tasks completed');
  console.log('=================================');
}
