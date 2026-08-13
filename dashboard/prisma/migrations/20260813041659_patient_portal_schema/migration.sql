-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "copayCents" INTEGER,
ADD COLUMN     "deductibleCents" INTEGER,
ADD COLUMN     "deductibleMetCents" INTEGER,
ADD COLUMN     "lastPaymentDate" TIMESTAMP(3),
ADD COLUMN     "outstandingBalanceCents" INTEGER,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentStatus" TEXT;
