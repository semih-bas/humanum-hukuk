ALTER TYPE "GeneralTaskStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "GeneralTaskStatus" ADD VALUE IF NOT EXISTS 'SENT';
ALTER TYPE "GeneralTaskStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_SENT';
ALTER TYPE "GeneralTaskStatus" ADD VALUE IF NOT EXISTS 'FAILED';

ALTER TABLE "general_case_task"
  ADD COLUMN "notifyAt" TIMESTAMP(3),
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "deliveryPreparedAt" TIMESTAMP(3),
  ADD COLUMN "nextPreparationAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "general_case_task"
SET "notifyAt" = "dueAt" - (COALESCE("reminderOffsetMinutes", 0) * INTERVAL '1 minute')
WHERE "deletedAt" IS NULL;

CREATE TABLE "general_task_delivery" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "status" "ReminderDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "general_task_delivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "general_task_delivery_taskId_recipientId_key" ON "general_task_delivery"("taskId", "recipientId");
CREATE INDEX "general_task_delivery_status_nextAttemptAt_idx" ON "general_task_delivery"("status", "nextAttemptAt");
CREATE INDEX "general_task_delivery_status_startedAt_idx" ON "general_task_delivery"("status", "startedAt");
CREATE INDEX "general_case_task_status_notifyAt_idx" ON "general_case_task"("status", "notifyAt");
CREATE INDEX "general_case_task_deliveryPreparedAt_nextPreparationAt_idx" ON "general_case_task"("deliveryPreparedAt", "nextPreparationAt");
ALTER TABLE "general_task_delivery" ADD CONSTRAINT "general_task_delivery_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "general_case_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "general_task_delivery" ADD CONSTRAINT "general_task_delivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
