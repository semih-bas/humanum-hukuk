ALTER TABLE "insurance_arbitration_case"
ALTER COLUMN "caseType" TYPE "InsuranceCaseType"[]
USING ARRAY["caseType"]::"InsuranceCaseType"[];

CREATE TABLE "insurance_arbitration_document" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "originalName" VARCHAR(255) NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "insurance_arbitration_document_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "insurance_arbitration_document_storageKey_key" ON "insurance_arbitration_document"("storageKey");
CREATE INDEX "insurance_arbitration_document_caseId_createdAt_idx" ON "insurance_arbitration_document"("caseId", "createdAt");
CREATE INDEX "insurance_arbitration_document_uploadedById_createdAt_idx" ON "insurance_arbitration_document"("uploadedById", "createdAt");
ALTER TABLE "insurance_arbitration_document" ADD CONSTRAINT "insurance_arbitration_document_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "insurance_arbitration_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insurance_arbitration_document" ADD CONSTRAINT "insurance_arbitration_document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
