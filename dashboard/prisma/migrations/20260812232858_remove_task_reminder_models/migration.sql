/*
  Warnings:

  - You are about to drop the `Reminder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Task` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Reminder" DROP CONSTRAINT "Reminder_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_emailId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_patientId_fkey";

-- DropTable
DROP TABLE "Reminder";

-- DropTable
DROP TABLE "Task";

-- DropEnum
DROP TYPE "ExtractionStatus";

-- DropEnum
DROP TYPE "TaskStatus";
