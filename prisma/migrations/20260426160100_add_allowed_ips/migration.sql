-- Add allowedIps column for WireGuard peers
ALTER TABLE "VPNUser" ADD COLUMN "allowedIps" TEXT;

-- Backfill from legacy ipAddress column if present
UPDATE "VPNUser"
SET "allowedIps" = "ipAddress"
WHERE "allowedIps" IS NULL;
