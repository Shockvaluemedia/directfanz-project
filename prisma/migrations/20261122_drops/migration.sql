-- Drops: content sold once (fixed or pay-what-you-want), unlocked for good.

-- CreateTable
CREATE TABLE "drops" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priceType" TEXT NOT NULL DEFAULT 'FIXED',
    "price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "quantityLimit" INTEGER,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drop_content" (
    "dropId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drop_content_pkey" PRIMARY KEY ("dropId","contentId")
);

-- CreateIndex
CREATE INDEX "drops_artistId_status_idx" ON "drops"("artistId", "status");

-- CreateIndex
CREATE INDEX "drops_status_startsAt_idx" ON "drops"("status", "startsAt");

-- CreateIndex
CREATE INDEX "drop_content_contentId_idx" ON "drop_content"("contentId");

-- AddForeignKey
ALTER TABLE "drops" ADD CONSTRAINT "drops_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drop_content" ADD CONSTRAINT "drop_content_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "drops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drop_content" ADD CONSTRAINT "drop_content_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
