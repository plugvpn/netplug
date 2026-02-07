/**
 * Script to ensure WireGuard server has public/private keys
 *
 * If the server record exists but doesn't have keys, this script will:
 * 1. Check if keys exist in the server record
 * 2. If not, generate new keys and update the record
 *
 * Usage: npx ts-node scripts/fix-wireguard-server-keys.ts
 */

import { PrismaClient } from '@prisma/client';
import { generateWireGuardKeyPair } from '../lib/wireguard/key-generator';

const prisma = new PrismaClient();

async function fixServerKeys() {
  console.log('🔍 Checking WireGuard server keys...\n');

  try {
    // Find WireGuard server
    const server = await prisma.vPNServer.findUnique({
      where: { id: 'wireguard' }
    });

    if (!server) {
      console.log('❌ No WireGuard server found in database.');
      console.log('   Please complete the initial setup first.');
      return;
    }

    console.log('📋 Current server configuration:');
    console.log(`   ID: ${server.id}`);
    console.log(`   Name: ${server.name}`);
    console.log(`   Host: ${server.host}`);
    console.log(`   Port: ${server.port}`);
    console.log(`   Private Key: ${server.privateKey ? '✓ Present' : '✗ Missing'}`);
    console.log(`   Public Key: ${server.publicKey ? '✓ Present' : '✗ Missing'}`);

    // Check if keys are missing
    if (server.privateKey && server.publicKey) {
      console.log('\n✅ Server already has both keys. No action needed.');
      return;
    }

    console.log('\n⚠️  Keys are missing. Generating new key pair...');

    // Generate new key pair
    const keyPair = generateWireGuardKeyPair();
    console.log(`   Generated private key: ${keyPair.privateKey.substring(0, 10)}...`);
    console.log(`   Generated public key: ${keyPair.publicKey.substring(0, 10)}...`);

    // Update server with new keys
    console.log('\n🔄 Updating server record...');
    await prisma.vPNServer.update({
      where: { id: 'wireguard' },
      data: {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
      }
    });

    console.log('✅ Server keys updated successfully!');
    console.log('\n⚠️  IMPORTANT: The server configuration file needs to be regenerated.');
    console.log('   Please restart your WireGuard service or regenerate the config.');

  } catch (error) {
    console.error('❌ Failed to fix server keys:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixServerKeys();
