ALTER TABLE "case_file" ADD COLUMN "documentFolders" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "insurance_arbitration_case" ADD COLUMN "documentFolders" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "case_document"
  ADD COLUMN "folderKey" VARCHAR(100),
  ADD COLUMN "deletedById" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "case_document" SET "folderKey" = "category" WHERE "folderKey" IS NULL;

ALTER TABLE "insurance_arbitration_document"
  ADD COLUMN "category" VARCHAR(50) NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "folderKey" VARCHAR(100),
  ADD COLUMN "deletedById" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "insurance_arbitration_document" SET "folderKey" = 'OTHER' WHERE "folderKey" IS NULL;

CREATE INDEX "case_document_caseFileId_folderKey_deletedAt_createdAt_idx" ON "case_document"("caseFileId", "folderKey", "deletedAt", "createdAt");
CREATE INDEX "case_document_deletedById_idx" ON "case_document"("deletedById");
CREATE INDEX "insurance_arbitration_document_caseId_folderKey_deletedAt_createdAt_idx" ON "insurance_arbitration_document"("caseId", "folderKey", "deletedAt", "createdAt");
CREATE INDEX "insurance_arbitration_document_deletedById_idx" ON "insurance_arbitration_document"("deletedById");

ALTER TABLE "case_document" ADD CONSTRAINT "case_document_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "insurance_arbitration_document" ADD CONSTRAINT "insurance_arbitration_document_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
