/**
 * Script to create a test VPN user for testing the status page
 *
 * Usage: node scripts/create-test-user.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Get the first VPN server
    const server = await prisma.vPNServer.findFirst();

    if (!server) {
      console.error('❌ No VPN server found. Please set up a server first.');
      process.exit(1);
    }

    // Create test user
    const testUser = await prisma.vPNUser.create({
      data: {
        username: 'testuser',
        ipAddress: '10.8.0.100', // Change this to your test IP
        serverId: server.id,
        remainingDays: 30,
        remainingTrafficBytes: BigInt(10737418240), // 10 GB
        totalBytesReceived: BigInt(1073741824), // 1 GB
        totalBytesSent: BigInt(536870912), // 512 MB
        isConnected: true,
        connectedAt: new Date(),
        isEnabled: true,
        // WireGuard keys (dummy values for testing)
        privateKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        publicKey: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
      },
      include: {
        server: true,
      },
    });

    console.log('✅ Test user created successfully!');
    console.log('');
    console.log('📋 User Details:');
    console.log(`   Username: ${testUser.username}`);
    console.log(`   IP Address: ${testUser.ipAddress}`);
    console.log(`   Remaining Days: ${testUser.remainingDays}`);
    console.log(`   Remaining Traffic: ${(Number(testUser.remainingTrafficBytes) / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`   Server: ${testUser.server.name}`);
    console.log('');
    console.log('🧪 Test the status page:');
    console.log(`   1. Visit: http://localhost:3000/`);
    console.log(`   2. Or test API: curl "http://localhost:3000/api/users/by-ip?ip=${testUser.ipAddress}"`);

  } catch (error) {
    if (error.code === 'P2002') {
      console.error('❌ User "testuser" already exists. Delete it first or use a different username.');
    } else {
      console.error('❌ Error creating test user:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
