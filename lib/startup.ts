import { initializeWireGuard, startWireGuardSyncService } from './wireguard/sync-service';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { execSync } from 'child_process';

// Global reference to WireGuard sync interval
let wireGuardSyncInterval: NodeJS.Timeout | null = null;

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

    // Initialize WireGuard
    console.log('[Startup] Initializing WireGuard...');
    await initializeWireGuard('wg0');

    // Start WireGuard sync service
    if (wireGuardSyncInterval) {
      clearInterval(wireGuardSyncInterval);
    }
    wireGuardSyncInterval = startWireGuardSyncService('wg0', 10000);
  } catch (error) {
    console.error('[Startup] Error during startup tasks:', error);
  }

  console.log('=================================');
  console.log('Startup tasks completed');
  console.log('=================================');
}
