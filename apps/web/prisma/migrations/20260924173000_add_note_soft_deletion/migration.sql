ALTER TABLE "case_note"
ADD COLUMN "deletedById" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "insurance_arbitration_note"
ADD COLUMN "deletedById" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "case_note_caseFileId_deletedAt_createdAt_idx"
ON "case_note"("caseFileId", "deletedAt", "createdAt");

CREATE INDEX "case_note_deletedById_idx" ON "case_note"("deletedById");

CREATE INDEX "insurance_arbitration_note_caseId_deletedAt_createdAt_idx"
ON "insurance_arbitration_note"("caseId", "deletedAt", "createdAt");

CREATE INDEX "insurance_arbitration_note_deletedById_idx"
ON "insurance_arbitration_note"("deletedById");

ALTER TABLE "case_note"
ADD CONSTRAINT "case_note_deletedById_fkey"
FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "insurance_arbitration_note"
ADD CONSTRAINT "insurance_arbitration_note_deletedById_fkey"
FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
