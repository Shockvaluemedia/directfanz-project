-- CreateTable for processing jobs
CREATE TABLE "processingJobs" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "originalFile" TEXT NOT NULL,
    "outputs" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processingJobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processingJobs_contentId_idx" ON "processingJobs"("contentId");
CREATE INDEX "processingJobs_userId_idx" ON "processingJobs"("userId");
CREATE INDEX "processingJobs_status_idx" ON "processingJobs"("status");
CREATE INDEX "processingJobs_createdAt_idx" ON "processingJobs"("createdAt");

-- Add foreign key constraints
ALTER TABLE "processingJobs" ADD CONSTRAINT "processingJobs_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "processingJobs" ADD CONSTRAINT "processingJobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add new columns to content table for processed media
ALTER TABLE "content" ADD COLUMN "processingJobId" TEXT;
ALTER TABLE "content" ADD COLUMN "processedOutputs" TEXT DEFAULT '[]';
ALTER TABLE "content" ADD COLUMN "thumbnailUrl" TEXT;
ALTER TABLE "content" ADD COLUMN "previewUrl" TEXT;
ALTER TABLE "content" ADD COLUMN "hlsUrl" TEXT;
ALTER TABLE "content" ADD COLUMN "waveformUrl" TEXT;
ALTER TABLE "content" ADD COLUMN "processingStatus" TEXT DEFAULT 'pending';

-- Add index for processing job reference
CREATE INDEX "content_processingJobId_idx" ON "content"("processingJobId");
CREATE INDEX "content_processingStatus_idx" ON "content"("processingStatus");

-- Add foreign key constraint
ALTER TABLE "content" ADD CONSTRAINT "content_processingJobId_fkey" FOREIGN KEY ("processingJobId") REFERENCES "processingJobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;