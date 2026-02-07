/**
 * Data migration script to populate totalBytesReceived and totalBytesSent
 * with existing bytesReceived and bytesSent values.
 *
 * Run this once after deploying the schema change:
 * npx ts-node scripts/migrate-transfer-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateTransferData() {
  console.log('Starting transfer data migration...');

  try {
    // Get all VPN users
    const users = await prisma.vPNUser.findMany({
      where: {
        server: {
          protocol: 'wireguard',
        },
      },
    });

    console.log(`Found ${users.length} WireGuard users to migrate`);

    let migratedCount = 0;

    for (const user of users) {
      // Only migrate if totalBytes fields are 0 (haven't been set yet)
      if (user.totalBytesReceived === BigInt(0) && user.totalBytesSent === BigInt(0)) {
        // If user currently has transfer data, add it to the cumulative totals
        if (user.bytesReceived > BigInt(0) || user.bytesSent > BigInt(0)) {
          await prisma.vPNUser.update({
            where: { id: user.id },
            data: {
              totalBytesReceived: user.bytesReceived,
              totalBytesSent: user.bytesSent,
            },
          });

          console.log(
            `Migrated ${user.username}: rx=${user.bytesReceived.toString()}, tx=${user.bytesSent.toString()}`
          );
          migratedCount++;
        }
      }
    }

    console.log(`\nMigration complete! Migrated ${migratedCount} users.`);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateTransferData()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
