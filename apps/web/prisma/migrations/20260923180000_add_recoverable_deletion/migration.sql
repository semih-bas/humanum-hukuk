ALTER TABLE "user"
ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN "deletionDueAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;

ALTER TABLE "case_file" ADD COLUMN "purgeAfter" TIMESTAMP(3);

ALTER TABLE "insurance_arbitration_case"
ADD COLUMN "archivedById" TEXT,
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "purgeAfter" TIMESTAMP(3);

ALTER TABLE "general_legal_case" ADD COLUMN "purgeAfter" TIMESTAMP(3);

CREATE INDEX "user_deletionDueAt_idx" ON "user"("deletionDueAt");
CREATE INDEX "case_file_purgeAfter_idx" ON "case_file"("purgeAfter");
CREATE INDEX "insurance_arbitration_case_archivedAt_idx" ON "insurance_arbitration_case"("archivedAt");
CREATE INDEX "insurance_arbitration_case_purgeAfter_idx" ON "insurance_arbitration_case"("purgeAfter");
CREATE INDEX "general_legal_case_purgeAfter_idx" ON "general_legal_case"("purgeAfter");

ALTER TABLE "insurance_arbitration_case"
ADD CONSTRAINT "insurance_arbitration_case_archivedById_fkey"
FOREIGN KEY ("archivedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
