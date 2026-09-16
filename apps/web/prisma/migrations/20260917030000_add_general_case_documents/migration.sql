CREATE TABLE "general_case_document" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "general_case_document_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "general_case_document_storageKey_key" ON "general_case_document"("storageKey");
CREATE INDEX "general_case_document_caseId_category_createdAt_idx" ON "general_case_document"("caseId", "category", "createdAt");
CREATE INDEX "general_case_document_uploadedById_createdAt_idx" ON "general_case_document"("uploadedById", "createdAt");

ALTER TABLE "general_case_document" ADD CONSTRAINT "general_case_document_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "general_legal_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "general_case_document" ADD CONSTRAINT "general_case_document_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
