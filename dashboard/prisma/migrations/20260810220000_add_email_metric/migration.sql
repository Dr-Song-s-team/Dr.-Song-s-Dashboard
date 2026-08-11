-- CreateTable
CREATE TABLE "EmailMetric" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "analysisUsefulness" INTEGER NOT NULL,
    "koreanTranslationAccuracy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMetric_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EmailMetric_analysisUsefulness_check" CHECK ("analysisUsefulness" >= 1 AND "analysisUsefulness" <= 5),
    CONSTRAINT "EmailMetric_koreanTranslationAccuracy_check" CHECK ("koreanTranslationAccuracy" >= 1 AND "koreanTranslationAccuracy" <= 5)
);

-- CreateIndex
CREATE INDEX "EmailMetric_emailId_idx" ON "EmailMetric"("emailId");

-- AddForeignKey
ALTER TABLE "EmailMetric" ADD CONSTRAINT "EmailMetric_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;
