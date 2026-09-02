ALTER TABLE "case_reminder" ALTER COLUMN "sendSms" SET DEFAULT false;
ALTER TABLE "case_reminder" ADD COLUMN "deliveryPreparedAt" TIMESTAMP(3),
  ADD COLUMN "nextPreparationAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "case_reminder_deliveryPreparedAt_nextPreparationAt_idx" ON "case_reminder"("deliveryPreparedAt", "nextPreparationAt");

CREATE TYPE "ReminderDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'UNCERTAIN', 'CANCELLED');
CREATE TABLE "reminder_delivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reminderId" TEXT NOT NULL REFERENCES "case_reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "recipientId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "recipientEmail" TEXT NOT NULL,
  "status" "ReminderDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "reminder_delivery_reminderId_recipientId_key" ON "reminder_delivery"("reminderId", "recipientId");
CREATE INDEX "reminder_delivery_status_nextAttemptAt_idx" ON "reminder_delivery"("status", "nextAttemptAt");
CREATE INDEX "reminder_delivery_status_startedAt_idx" ON "reminder_delivery"("status", "startedAt");
