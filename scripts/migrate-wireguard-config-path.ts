/**
 * Migration script to update WireGuard configPath from /etc/wireguard/wg0.conf to $DATA_DIR/wg0.conf
 *
 * This script updates existing VPNServer records to use the correct DATA_DIR-based path
 * for the WireGuard configuration file.
 *
 * Usage: npx ts-node scripts/migrate-wireguard-config-path.ts
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();

async function migrate() {
  console.log('🔧 Starting WireGuard configPath migration...\n');

  try {
    // Get DATA_DIR from environment
    const dataDir = process.env.DATA_DIR || '/data';
    const newConfigPath = path.join(dataDir, 'wg0.conf');

    console.log(`📁 DATA_DIR: ${dataDir}`);
    console.log(`🎯 New configPath: ${newConfigPath}\n`);

    // Find WireGuard server
    const server = await prisma.vPNServer.findUnique({
      where: { id: 'wireguard' }
    });

    if (!server) {
      console.log('ℹ️  No WireGuard server found in database. Nothing to migrate.');
      return;
    }

    console.log('📋 Current server configuration:');
    console.log(`   ID: ${server.id}`);
    console.log(`   Name: ${server.name}`);
    console.log(`   Current configPath: ${server.configPath}`);

    // Check if migration is needed
    if (server.configPath === newConfigPath) {
      console.log('\n✅ Server already has the correct configPath. No migration needed.');
      return;
    }

    // Update the configPath
    console.log('\n🔄 Updating configPath...');
    await prisma.vPNServer.update({
      where: { id: 'wireguard' },
      data: {
        configPath: newConfigPath
      }
    });

    console.log('✅ Migration completed successfully!');
    console.log(`   Old path: ${server.configPath}`);
    console.log(`   New path: ${newConfigPath}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
