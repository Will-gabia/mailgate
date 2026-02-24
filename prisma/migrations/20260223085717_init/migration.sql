-- CreateTable
CREATE TABLE "Email" (
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
    "matchedRule" TEXT
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailId" TEXT NOT NULL,
    "filename" TEXT,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT,
    "storagePath" TEXT,
    CONSTRAINT "Attachment_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassificationRule" (
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
    "category" TEXT
);

-- CreateTable
CREATE TABLE "ForwardLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailId" TEXT NOT NULL,
    "forwardTo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "smtpResponse" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ForwardLog_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Email_messageId_key" ON "Email"("messageId");

-- CreateIndex
CREATE INDEX "Email_status_idx" ON "Email"("status");

-- CreateIndex
CREATE INDEX "Email_category_idx" ON "Email"("category");

-- CreateIndex
CREATE INDEX "Email_createdAt_idx" ON "Email"("createdAt");

-- CreateIndex
CREATE INDEX "Email_mailFrom_idx" ON "Email"("mailFrom");

-- CreateIndex
CREATE INDEX "Attachment_emailId_idx" ON "Attachment"("emailId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassificationRule_name_key" ON "ClassificationRule"("name");

-- CreateIndex
CREATE INDEX "ClassificationRule_priority_idx" ON "ClassificationRule"("priority");

-- CreateIndex
CREATE INDEX "ClassificationRule_enabled_idx" ON "ClassificationRule"("enabled");

-- CreateIndex
CREATE INDEX "ForwardLog_emailId_idx" ON "ForwardLog"("emailId");

-- CreateIndex
CREATE INDEX "ForwardLog_status_idx" ON "ForwardLog"("status");
