ALTER TABLE "general_case_document"
ADD COLUMN "deletedById" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "general_case_document_caseId_deletedAt_idx" ON "general_case_document"("caseId", "deletedAt");

ALTER TABLE "general_case_document"
ADD CONSTRAINT "general_case_document_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
