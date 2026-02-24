-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "domains" TEXT NOT NULL,
    "settings" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClassificationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "conditions" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "forwardTo" TEXT,
    "category" TEXT,
    "tenantId" TEXT,
    CONSTRAINT "ClassificationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ClassificationRule" ("action", "category", "conditions", "createdAt", "description", "enabled", "forwardTo", "id", "name", "priority", "updatedAt") SELECT "action", "category", "conditions", "createdAt", "description", "enabled", "forwardTo", "id", "name", "priority", "updatedAt" FROM "ClassificationRule";
DROP TABLE "ClassificationRule";
ALTER TABLE "new_ClassificationRule" RENAME TO "ClassificationRule";
CREATE UNIQUE INDEX "ClassificationRule_name_key" ON "ClassificationRule"("name");
CREATE INDEX "ClassificationRule_tenantId_idx" ON "ClassificationRule"("tenantId");
CREATE INDEX "ClassificationRule_priority_idx" ON "ClassificationRule"("priority");
CREATE INDEX "ClassificationRule_enabled_idx" ON "ClassificationRule"("enabled");
CREATE INDEX "ClassificationRule_enabled_tenantId_priority_idx" ON "ClassificationRule"("enabled", "tenantId", "priority");
CREATE TABLE "new_Email" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "mailFrom" TEXT NOT NULL,
    "rcptTo" TEXT NOT NULL,
    "remoteIp" TEXT NOT NULL,
    "messageId" TEXT,
    "subject" TEXT,
    "fromHeader" TEXT,
    "toHeader" TEXT,
    "ccHeader" TEXT,
    "replyTo" TEXT,
    "date" DATETIME,
    "headers" TEXT,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "rawMessage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "category" TEXT,
    "matchedRule" TEXT,
    "tenantId" TEXT,
    CONSTRAINT "Email_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Email" ("category", "ccHeader", "createdAt", "date", "fromHeader", "headers", "htmlBody", "id", "mailFrom", "matchedRule", "messageId", "rawMessage", "rcptTo", "remoteIp", "replyTo", "status", "subject", "textBody", "toHeader", "updatedAt") SELECT "category", "ccHeader", "createdAt", "date", "fromHeader", "headers", "htmlBody", "id", "mailFrom", "matchedRule", "messageId", "rawMessage", "rcptTo", "remoteIp", "replyTo", "status", "subject", "textBody", "toHeader", "updatedAt" FROM "Email";
DROP TABLE "Email";
ALTER TABLE "new_Email" RENAME TO "Email";
CREATE UNIQUE INDEX "Email_messageId_key" ON "Email"("messageId");
CREATE INDEX "Email_tenantId_idx" ON "Email"("tenantId");
CREATE INDEX "Email_status_idx" ON "Email"("status");
CREATE INDEX "Email_category_idx" ON "Email"("category");
CREATE INDEX "Email_createdAt_idx" ON "Email"("createdAt");
CREATE INDEX "Email_mailFrom_idx" ON "Email"("mailFrom");
CREATE INDEX "Email_status_createdAt_idx" ON "Email"("status", "createdAt");
CREATE INDEX "Email_tenantId_status_createdAt_idx" ON "Email"("tenantId", "status", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_name_key" ON "Tenant"("name");
