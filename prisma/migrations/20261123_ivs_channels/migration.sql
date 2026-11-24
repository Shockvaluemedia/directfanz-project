-- Listening parties on Amazon IVS: each party's private channel. The stream
-- key value is not stored; the app reads it from IVS for the artist only.

-- AlterTable
ALTER TABLE "live_streams" ADD COLUMN "ivsChannelArn" TEXT,
ADD COLUMN "ivsIngestEndpoint" TEXT,
ADD COLUMN "ivsPlaybackUrl" TEXT,
ADD COLUMN "ivsStreamKeyArn" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "live_streams_ivsChannelArn_key" ON "live_streams"("ivsChannelArn");
