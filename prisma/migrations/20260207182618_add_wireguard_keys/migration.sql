-- AlterTable
ALTER TABLE "VPNServer" ADD COLUMN "privateKey" TEXT;
ALTER TABLE "VPNServer" ADD COLUMN "publicKey" TEXT;

-- AlterTable
ALTER TABLE "VPNUser" ADD COLUMN "privateKey" TEXT;
ALTER TABLE "VPNUser" ADD COLUMN "publicKey" TEXT;
