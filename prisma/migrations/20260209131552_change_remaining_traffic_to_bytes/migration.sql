/*
  Warnings:

  - You are about to drop the column `remainingTrafficGB` on the `VPNUser` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VPNUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "commonName" TEXT,
    "ipAddress" TEXT,
    "endpoint" TEXT,
    "lastHandshake" DATETIME,
    "privateKey" TEXT,
    "publicKey" TEXT,
    "presharedKey" TEXT,
    "bytesReceived" BIGINT NOT NULL DEFAULT 0,
    "bytesSent" BIGINT NOT NULL DEFAULT 0,
    "prevBytesReceived" BIGINT NOT NULL DEFAULT 0,
    "prevBytesSent" BIGINT NOT NULL DEFAULT 0,
    "bytesReceivedRate" BIGINT NOT NULL DEFAULT 0,
    "bytesSentRate" BIGINT NOT NULL DEFAULT 0,
    "totalBytesReceived" BIGINT NOT NULL DEFAULT 0,
    "totalBytesSent" BIGINT NOT NULL DEFAULT 0,
    "remainingDays" INTEGER,
    "remainingTrafficBytes" BIGINT,
    "connectedAt" DATETIME,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "serverId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VPNUser_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "VPNServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VPNUser" ("bytesReceived", "bytesReceivedRate", "bytesSent", "bytesSentRate", "commonName", "connectedAt", "createdAt", "endpoint", "id", "ipAddress", "isConnected", "isEnabled", "lastHandshake", "presharedKey", "prevBytesReceived", "prevBytesSent", "privateKey", "publicKey", "remainingDays", "serverId", "totalBytesReceived", "totalBytesSent", "updatedAt", "username") SELECT "bytesReceived", "bytesReceivedRate", "bytesSent", "bytesSentRate", "commonName", "connectedAt", "createdAt", "endpoint", "id", "ipAddress", "isConnected", "isEnabled", "lastHandshake", "presharedKey", "prevBytesReceived", "prevBytesSent", "privateKey", "publicKey", "remainingDays", "serverId", "totalBytesReceived", "totalBytesSent", "updatedAt", "username" FROM "VPNUser";
DROP TABLE "VPNUser";
ALTER TABLE "new_VPNUser" RENAME TO "VPNUser";
CREATE UNIQUE INDEX "VPNUser_username_key" ON "VPNUser"("username");
CREATE INDEX "VPNUser_serverId_idx" ON "VPNUser"("serverId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
