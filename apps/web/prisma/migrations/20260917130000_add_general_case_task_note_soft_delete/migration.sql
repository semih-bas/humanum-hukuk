ALTER TABLE "general_case_task"
ADD COLUMN "deletedById" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "general_case_note"
ADD COLUMN "deletedById" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "general_case_task_caseId_deletedAt_idx" ON "general_case_task"("caseId", "deletedAt");
CREATE INDEX "general_case_note_caseId_deletedAt_idx" ON "general_case_note"("caseId", "deletedAt");

ALTER TABLE "general_case_task"
ADD CONSTRAINT "general_case_task_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "general_case_note"
ADD CONSTRAINT "general_case_note_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
