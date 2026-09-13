CREATE TYPE "CaseTransactionType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "CaseTransactionCategory" AS ENUM ('PRINCIPAL', 'PRE_FOLLOW_UP_INTEREST', 'POST_FOLLOW_UP_INTEREST', 'ATTORNEY_FEE', 'EXPENSE', 'LITIGATION_EXPENSE', 'PRISON_FEE', 'COLLECTION_FEE', 'OTHER');

CREATE TABLE "case_transaction" (
  "id" TEXT NOT NULL,
  "caseFileId" TEXT NOT NULL,
  "type" "CaseTransactionType" NOT NULL,
  "category" "CaseTransactionCategory" NOT NULL,
  "transactionDate" DATE NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "createdById" TEXT NOT NULL,
  "deletedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "case_transaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "case_transaction_amount_check" CHECK ("amount" > 0)
);

ALTER TABLE "case_document" ADD COLUMN "transactionId" TEXT;

CREATE INDEX "case_transaction_caseFileId_transactionDate_createdAt_idx" ON "case_transaction"("caseFileId", "transactionDate", "createdAt");
CREATE INDEX "case_transaction_caseFileId_deletedAt_idx" ON "case_transaction"("caseFileId", "deletedAt");
CREATE INDEX "case_transaction_createdById_createdAt_idx" ON "case_transaction"("createdById", "createdAt");
CREATE INDEX "case_document_transactionId_idx" ON "case_document"("transactionId");

ALTER TABLE "case_transaction" ADD CONSTRAINT "case_transaction_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "case_file"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_transaction" ADD CONSTRAINT "case_transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "case_transaction" ADD CONSTRAINT "case_transaction_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "case_document" ADD CONSTRAINT "case_document_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "case_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
