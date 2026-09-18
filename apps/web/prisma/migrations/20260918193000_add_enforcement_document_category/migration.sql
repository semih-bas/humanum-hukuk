ALTER TABLE "case_document"
ADD COLUMN "category" VARCHAR(50) NOT NULL DEFAULT 'OTHER';

CREATE INDEX "case_document_caseFileId_category_createdAt_idx"
ON "case_document"("caseFileId", "category", "createdAt");
