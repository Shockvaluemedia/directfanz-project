/*
  Warnings:

  - You are about to alter the column `totalEarnings` on the `artists` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.
  - You are about to alter the column `amount` on the `invoices` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.
  - You are about to alter the column `prorationAmount` on the `invoices` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.
  - You are about to alter the column `amount` on the `payment_failures` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.
  - You are about to alter the column `amount` on the `subscriptions` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.
  - You are about to alter the column `minimumPrice` on the `tiers` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.

*/
-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "attachmentUrl" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "resolution" TEXT,
    "action" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reports_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_artists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stripeAccountId" TEXT,
    "isStripeOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "totalEarnings" DECIMAL NOT NULL DEFAULT 0,
    "totalSubscribers" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "artists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_artists" ("createdAt", "id", "isStripeOnboarded", "stripeAccountId", "totalEarnings", "totalSubscribers", "updatedAt", "userId") SELECT "createdAt", "id", "isStripeOnboarded", "stripeAccountId", "totalEarnings", "totalSubscribers", "updatedAt", "userId" FROM "artists";
DROP TABLE "artists";
ALTER TABLE "new_artists" RENAME TO "artists";
CREATE UNIQUE INDEX "artists_userId_key" ON "artists"("userId");
CREATE UNIQUE INDEX "artists_stripeAccountId_key" ON "artists"("stripeAccountId");
CREATE TABLE "new_invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "paidAt" DATETIME,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "prorationAmount" DECIMAL,
    "items" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_invoices" ("amount", "createdAt", "dueDate", "id", "items", "paidAt", "periodEnd", "periodStart", "prorationAmount", "status", "stripeInvoiceId", "subscriptionId", "updatedAt") SELECT "amount", "createdAt", "dueDate", "id", "items", "paidAt", "periodEnd", "periodStart", "prorationAmount", "status", "stripeInvoiceId", "subscriptionId", "updatedAt" FROM "invoices";
DROP TABLE "invoices";
ALTER TABLE "new_invoices" RENAME TO "invoices";
CREATE UNIQUE INDEX "invoices_stripeInvoiceId_key" ON "invoices"("stripeInvoiceId");
CREATE TABLE "new_payment_failures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "nextRetryAt" DATETIME,
    "failureReason" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payment_failures_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_payment_failures" ("amount", "attemptCount", "createdAt", "failureReason", "id", "isResolved", "nextRetryAt", "stripeInvoiceId", "subscriptionId", "updatedAt") SELECT "amount", "attemptCount", "createdAt", "failureReason", "id", "isResolved", "nextRetryAt", "stripeInvoiceId", "subscriptionId", "updatedAt" FROM "payment_failures";
DROP TABLE "payment_failures";
ALTER TABLE "new_payment_failures" RENAME TO "payment_failures";
CREATE UNIQUE INDEX "payment_failures_stripeInvoiceId_key" ON "payment_failures"("stripeInvoiceId");
CREATE TABLE "new_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fanId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodStart" DATETIME NOT NULL,
    "currentPeriodEnd" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "subscriptions_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subscriptions_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "tiers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_subscriptions" ("amount", "artistId", "createdAt", "currentPeriodEnd", "currentPeriodStart", "fanId", "id", "status", "stripeSubscriptionId", "tierId", "updatedAt") SELECT "amount", "artistId", "createdAt", "currentPeriodEnd", "currentPeriodStart", "fanId", "id", "status", "stripeSubscriptionId", "tierId", "updatedAt" FROM "subscriptions";
DROP TABLE "subscriptions";
ALTER TABLE "new_subscriptions" RENAME TO "subscriptions";
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");
CREATE UNIQUE INDEX "subscriptions_fanId_tierId_key" ON "subscriptions"("fanId", "tierId");
CREATE TABLE "new_tiers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minimumPrice" DECIMAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subscriberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tiers_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tiers" ("artistId", "createdAt", "description", "id", "isActive", "minimumPrice", "name", "subscriberCount", "updatedAt") SELECT "artistId", "createdAt", "description", "id", "isActive", "minimumPrice", "name", "subscriberCount", "updatedAt" FROM "tiers";
DROP TABLE "tiers";
ALTER TABLE "new_tiers" RENAME TO "tiers";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
