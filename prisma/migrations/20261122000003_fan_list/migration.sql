-- Fan list: an artist's own opt-in list (email and text messages, opted into
-- separately), and the announcements sent to it.

-- CreateTable
CREATE TABLE "fan_list_members" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SIGNUP',
    "emailConsentedAt" TIMESTAMP(3),
    "emailUnsubscribedAt" TIMESTAMP(3),
    "smsPhone" TEXT,
    "smsConsentedAt" TIMESTAMP(3),
    "smsConsentText" TEXT,
    "smsUnsubscribedAt" TIMESTAMP(3),
    "unsubscribeToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fan_list_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fan_list_announcements" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "smsBody" TEXT,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "smsRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "smsFailedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fan_list_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fan_list_members_unsubscribeToken_key" ON "fan_list_members"("unsubscribeToken");

-- CreateIndex
CREATE UNIQUE INDEX "fan_list_members_artistId_fanId_key" ON "fan_list_members"("artistId", "fanId");

-- CreateIndex
CREATE INDEX "fan_list_members_artistId_emailUnsubscribedAt_idx" ON "fan_list_members"("artistId", "emailUnsubscribedAt");

-- CreateIndex
CREATE INDEX "fan_list_members_smsPhone_idx" ON "fan_list_members"("smsPhone");

-- CreateIndex
CREATE INDEX "fan_list_members_fanId_idx" ON "fan_list_members"("fanId");

-- CreateIndex
CREATE INDEX "fan_list_announcements_artistId_createdAt_idx" ON "fan_list_announcements"("artistId", "createdAt");

-- AddForeignKey
ALTER TABLE "fan_list_members" ADD CONSTRAINT "fan_list_members_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fan_list_members" ADD CONSTRAINT "fan_list_members_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fan_list_announcements" ADD CONSTRAINT "fan_list_announcements_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
