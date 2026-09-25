ALTER TABLE "case_reminder"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "reminderType" VARCHAR(100),
  ADD COLUMN "priority" VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "eventAt" TIMESTAMP(3);

UPDATE "case_reminder" SET "eventAt" = "dueAt" WHERE "eventAt" IS NULL;
ALTER TABLE "case_reminder" ALTER COLUMN "eventAt" SET NOT NULL;

CREATE TABLE "insurance_arbitration_notification" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "deletedById" TEXT,
  "title" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "reminderType" VARCHAR(100),
  "priority" VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
  "eventAt" TIMESTAMP(3) NOT NULL,
  "notifyAt" TIMESTAMP(3) NOT NULL,
  "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "insurance_arbitration_notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "insurance_arbitration_notification_caseId_deletedAt_eventAt_idx" ON "insurance_arbitration_notification"("caseId", "deletedAt", "eventAt");
CREATE INDEX "insurance_arbitration_notification_status_notifyAt_idx" ON "insurance_arbitration_notification"("status", "notifyAt");
CREATE INDEX "insurance_arbitration_notification_createdById_createdAt_idx" ON "insurance_arbitration_notification"("createdById", "createdAt");

ALTER TABLE "insurance_arbitration_notification" ADD CONSTRAINT "insurance_arbitration_notification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "insurance_arbitration_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insurance_arbitration_notification" ADD CONSTRAINT "insurance_arbitration_notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "insurance_arbitration_notification" ADD CONSTRAINT "insurance_arbitration_notification_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
