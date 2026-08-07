-- Add the explicit display/filter label required by the EMS inbox.
-- Existing records can continue to use their related patient's insurer.
ALTER TABLE "Email" ADD COLUMN "insurerLabel" TEXT;

-- Inbox filters and newest-first listing query these fields.
CREATE INDEX "Email_receivedAt_idx" ON "Email"("receivedAt");
CREATE INDEX "Email_status_idx" ON "Email"("status");
CREATE INDEX "Email_insurerLabel_idx" ON "Email"("insurerLabel");
