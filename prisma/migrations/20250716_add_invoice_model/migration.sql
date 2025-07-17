-- Add notificationPreferences field to User model
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notificationPreferences" JSONB;

-- Create PaymentFailure model
CREATE TABLE IF NOT EXISTS "payment_failures" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "stripeInvoiceId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "nextRetryAt" TIMESTAMP(3),
  "failureReason" TEXT NOT NULL,
  "isResolved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "payment_failures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_failures_stripeInvoiceId_key" UNIQUE ("stripeInvoiceId"),
  CONSTRAINT "payment_failures_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create Invoice model
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "stripeInvoiceId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "prorationAmount" DECIMAL(10,2),
  "items" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoices_stripeInvoiceId_key" UNIQUE ("stripeInvoiceId"),
  CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "payment_failures_subscriptionId_idx" ON "payment_failures"("subscriptionId");
CREATE INDEX IF NOT EXISTS "invoices_subscriptionId_idx" ON "invoices"("subscriptionId");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");
CREATE INDEX IF NOT EXISTS "invoices_paidAt_idx" ON "invoices"("paidAt");