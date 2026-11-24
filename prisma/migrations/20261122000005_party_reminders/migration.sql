-- Listening parties: record when a ticket holder was sent the "starting soon" email.

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
