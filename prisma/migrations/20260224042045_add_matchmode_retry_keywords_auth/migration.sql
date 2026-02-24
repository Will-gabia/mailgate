-- AlterTable
ALTER TABLE "Email" ADD COLUMN "dkimResult" TEXT;
ALTER TABLE "Email" ADD COLUMN "keywords" TEXT;
ALTER TABLE "Email" ADD COLUMN "spfResult" TEXT;

-- AlterTable
ALTER TABLE "ForwardLog" ADD COLUMN "nextRetryAt" DATETIME;

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
    "matchMode" TEXT NOT NULL DEFAULT 'all',
    "action" TEXT NOT NULL,
    "forwardTo" TEXT,
    "category" TEXT,
    "tenantId" TEXT,
    CONSTRAINT "ClassificationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ClassificationRule" ("action", "category", "conditions", "createdAt", "description", "enabled", "forwardTo", "id", "name", "priority", "tenantId", "updatedAt") SELECT "action", "category", "conditions", "createdAt", "description", "enabled", "forwardTo", "id", "name", "priority", "tenantId", "updatedAt" FROM "ClassificationRule";
DROP TABLE "ClassificationRule";
ALTER TABLE "new_ClassificationRule" RENAME TO "ClassificationRule";
CREATE UNIQUE INDEX "ClassificationRule_name_key" ON "ClassificationRule"("name");
CREATE INDEX "ClassificationRule_tenantId_idx" ON "ClassificationRule"("tenantId");
CREATE INDEX "ClassificationRule_priority_idx" ON "ClassificationRule"("priority");
CREATE INDEX "ClassificationRule_enabled_idx" ON "ClassificationRule"("enabled");
CREATE INDEX "ClassificationRule_enabled_tenantId_priority_idx" ON "ClassificationRule"("enabled", "tenantId", "priority");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
