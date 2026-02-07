-- CreateTable
CREATE TABLE "BandwidthSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadRate" BIGINT NOT NULL,
    "uploadRate" BIGINT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "BandwidthSnapshot_timestamp_idx" ON "BandwidthSnapshot"("timestamp");
