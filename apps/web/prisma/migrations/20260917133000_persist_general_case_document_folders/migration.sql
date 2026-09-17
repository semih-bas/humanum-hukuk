ALTER TABLE "general_legal_case"
ADD COLUMN "documentFolders" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "general_case_document"
ADD COLUMN "folderKey" VARCHAR(80);

CREATE INDEX "general_case_document_caseId_folderKey_idx" ON "general_case_document"("caseId", "folderKey");
