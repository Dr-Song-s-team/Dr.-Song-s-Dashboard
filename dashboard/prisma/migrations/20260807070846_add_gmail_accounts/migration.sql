/*
  Warnings:

  - A unique constraint covering the columns `[gmailMessageId]` on the table `Email` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `gmailMessageId` to the `Email` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "gmailAccountId" TEXT,
ADD COLUMN     "gmailMessageId" TEXT NOT NULL,
ADD COLUMN     "gmailThreadId" TEXT;

-- CreateTable
CREATE TABLE "GmailAccount" (
    "id" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailAccount_emailAddress_key" ON "GmailAccount"("emailAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Email_gmailMessageId_key" ON "Email"("gmailMessageId");

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_gmailAccountId_fkey" FOREIGN KEY ("gmailAccountId") REFERENCES "GmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
