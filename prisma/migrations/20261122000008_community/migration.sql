-- One community: curated artists, invite-only artist sign-up.

-- CreateTable
CREATE TABLE "communities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artist_invites" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "email" TEXT,
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artist_invites_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "artists" ADD COLUMN "communityId" TEXT,
ADD COLUMN "featuredRank" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "communities_slug_key" ON "communities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "artist_invites_codeHash_key" ON "artist_invites"("codeHash");

-- CreateIndex
CREATE INDEX "artist_invites_communityId_idx" ON "artist_invites"("communityId");

-- CreateIndex
CREATE INDEX "artists_communityId_featuredRank_idx" ON "artists"("communityId", "featuredRank");

-- AddForeignKey
ALTER TABLE "artists" ADD CONSTRAINT "artists_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_invites" ADD CONSTRAINT "artist_invites_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
