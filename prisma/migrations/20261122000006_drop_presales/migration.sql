-- Drops: an optional members-only presale window before the public start.

-- AlterTable
ALTER TABLE "drops" ADD COLUMN "presaleStartsAt" TIMESTAMP(3);
