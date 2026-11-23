-- One-time purchases (drops, presales, listening-party tickets) and Stripe
-- webhook event de-duplication.

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "platformFee" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stripeAccountId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchases_stripeCheckoutSessionId_key" ON "purchases"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_stripePaymentIntentId_key" ON "purchases"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "purchases_fanId_itemType_itemId_status_idx" ON "purchases"("fanId", "itemType", "itemId", "status");

-- CreateIndex
CREATE INDEX "purchases_artistId_status_idx" ON "purchases"("artistId", "status");

-- CreateIndex
CREATE INDEX "purchases_itemType_itemId_status_idx" ON "purchases"("itemType", "itemId", "status");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_status_updatedAt_idx" ON "stripe_webhook_events"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
