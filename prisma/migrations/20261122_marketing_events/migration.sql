-- Marketing event feed: an outbox of signed webhook deliveries to a marketing
-- tool. Rows are written only while MARKETING_WEBHOOK_URL is set.

-- CreateTable
CREATE TABLE "marketing_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_events_status_nextAttemptAt_idx" ON "marketing_events"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "marketing_events_createdAt_idx" ON "marketing_events"("createdAt");
