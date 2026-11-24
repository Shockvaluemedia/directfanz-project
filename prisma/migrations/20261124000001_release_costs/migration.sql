-- Drops: what each release cost, entered by the artist for the release report.

-- AlterTable
ALTER TABLE "drops" ADD COLUMN "costRecording" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "costVideo" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "costMarketing" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "costOther" DECIMAL(65,30) NOT NULL DEFAULT 0;
