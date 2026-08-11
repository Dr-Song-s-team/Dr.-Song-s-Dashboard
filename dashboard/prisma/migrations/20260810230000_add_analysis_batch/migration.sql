-- CreateTable
CREATE TABLE "AnalysisBatch" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "emailsAttempted" INTEGER NOT NULL,
    "emailsSucceeded" INTEGER NOT NULL DEFAULT 0,
    "emailsFailed" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisBatch_createdAt_idx" ON "AnalysisBatch"("createdAt");
