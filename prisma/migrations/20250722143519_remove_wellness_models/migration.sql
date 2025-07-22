/*
  Warnings:

  - You are about to drop the `appointments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `assessment_responses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `assessment_scores` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `content_blocks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `offers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `orders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_skus` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `profile_attributes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `program_enrollments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `program_weeks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `programs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `system_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "appointments";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "assessment_responses";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "assessment_scores";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "content_blocks";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "offers";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "orders";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "product_skus";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "profile_attributes";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "program_enrollments";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "program_weeks";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "programs";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "system_settings";
PRAGMA foreign_keys=on;
