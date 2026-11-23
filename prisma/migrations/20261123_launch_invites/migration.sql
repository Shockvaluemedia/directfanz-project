-- Launch lineup: an invite can name its slot and the home-page place the
-- artist takes on joining (Nahvee 1, Never More 2).

-- AlterTable
ALTER TABLE "artist_invites" ADD COLUMN "featuredRank" INTEGER,
ADD COLUMN "label" TEXT;

-- CreateIndex
CREATE INDEX "artist_invites_communityId_label_idx" ON "artist_invites"("communityId", "label");
