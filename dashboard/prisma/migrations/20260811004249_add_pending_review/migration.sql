-- AlterEnum
ALTER TYPE "ExtractionStatus" ADD VALUE 'PENDING_REVIEW';

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "extractionStatus" SET DEFAULT 'PENDING_REVIEW';
