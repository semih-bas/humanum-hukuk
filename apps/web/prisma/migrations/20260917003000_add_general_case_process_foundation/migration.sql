CREATE TYPE "GeneralProcessEntryType" AS ENUM ('STAGE_CHANGE', 'FILING', 'NOTIFICATION', 'HEARING', 'DECISION', 'OTHER');
CREATE TYPE "GeneralHearingStatus" AS ENUM ('PLANNED', 'COMPLETED', 'POSTPONED', 'CANCELLED');

CREATE TABLE "general_case_process_entry" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "type" "GeneralProcessEntryType" NOT NULL,
  "stage" "GeneralCaseStage" NOT NULL,
  "eventDate" DATE NOT NULL,
  "action" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "responsibleUserId" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "deletedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "general_case_process_entry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "general_case_process_entry_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "general_case_hearing" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "court" VARCHAR(150) NOT NULL,
  "hearingType" VARCHAR(100) NOT NULL,
  "courtroom" VARCHAR(100),
  "attendeeUserId" TEXT,
  "reminderOffsetMinutes" INTEGER,
  "note" TEXT,
  "status" "GeneralHearingStatus" NOT NULL DEFAULT 'PLANNED',
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "deletedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "general_case_hearing_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "general_case_hearing_reminderOffsetMinutes_check" CHECK ("reminderOffsetMinutes" IS NULL OR "reminderOffsetMinutes" BETWEEN 0 AND 525600),
  CONSTRAINT "general_case_hearing_version_check" CHECK ("version" >= 1)
);

CREATE INDEX "general_case_process_entry_caseId_eventDate_createdAt_idx" ON "general_case_process_entry"("caseId", "eventDate", "createdAt");
CREATE INDEX "general_case_process_entry_caseId_stage_deletedAt_idx" ON "general_case_process_entry"("caseId", "stage", "deletedAt");
CREATE INDEX "general_case_process_entry_responsibleUserId_idx" ON "general_case_process_entry"("responsibleUserId");
CREATE INDEX "general_case_hearing_caseId_startsAt_idx" ON "general_case_hearing"("caseId", "startsAt");
CREATE INDEX "general_case_hearing_caseId_status_deletedAt_idx" ON "general_case_hearing"("caseId", "status", "deletedAt");
CREATE INDEX "general_case_hearing_attendeeUserId_idx" ON "general_case_hearing"("attendeeUserId");

ALTER TABLE "general_case_process_entry" ADD CONSTRAINT "general_case_process_entry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "general_legal_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "general_case_process_entry" ADD CONSTRAINT "general_case_process_entry_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "general_case_process_entry" ADD CONSTRAINT "general_case_process_entry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "general_case_process_entry" ADD CONSTRAINT "general_case_process_entry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "general_case_process_entry" ADD CONSTRAINT "general_case_process_entry_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "general_case_hearing" ADD CONSTRAINT "general_case_hearing_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "general_legal_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "general_case_hearing" ADD CONSTRAINT "general_case_hearing_attendeeUserId_fkey" FOREIGN KEY ("attendeeUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "general_case_hearing" ADD CONSTRAINT "general_case_hearing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "general_case_hearing" ADD CONSTRAINT "general_case_hearing_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "general_case_hearing" ADD CONSTRAINT "general_case_hearing_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
