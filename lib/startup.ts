import { initializeWireGuard, startWireGuardSyncService, bringDownWireGuard } from './wireguard/sync-service';
import { existsSync } from 'fs';
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

/**
 * Initialize database if it doesn't exist
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

  // Resolve path relative to prisma directory
  const prismaDir = resolve(process.cwd(), 'prisma');
  const dbPath = resolve(prismaDir, fileMatch[1]);

  console.log(`[Startup] Checking database at: ${dbPath}`);

  // Check if database file exists
  if (existsSync(dbPath)) {
    console.log('[Startup] ✓ Database file exists');
    return true;
  }

  console.log('[Startup] Database file not found, initializing...');

  try {
    // Ensure directory exists
    const dbDir = dirname(dbPath);
    console.log(`[Startup] Creating directory: ${dbDir}`);
    await mkdir(dbDir, { recursive: true });

    // Run Prisma migrations to create database and schema
    console.log('[Startup] Running Prisma migrations...');
    execSync('prisma migrate deploy', {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    });

    console.log('[Startup] ✓ Database initialized successfully');
    return true;
  } catch (error) {
    console.error('[Startup] Failed to initialize database:', error);
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
    wireGuardSyncInterval = startWireGuardSyncService('wg0', 10000);

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
