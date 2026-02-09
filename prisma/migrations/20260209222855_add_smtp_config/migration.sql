-- CreateTable
CREATE TABLE "SmtpConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "encryption" TEXT NOT NULL DEFAULT 'TLS',
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
