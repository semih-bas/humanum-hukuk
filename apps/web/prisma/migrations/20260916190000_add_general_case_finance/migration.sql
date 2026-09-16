CREATE TYPE "GeneralFinancialEntryType" AS ENUM ('EXPENSE', 'COLLECTION', 'PAYMENT');
CREATE TYPE "GeneralCollectionStatus" AS ENUM ('NOT_COLLECTED', 'PARTIAL', 'COLLECTED');
CREATE TYPE "GeneralPaymentPlan" AS ENUM ('CASH', 'INSTALLMENT');

ALTER TABLE "general_legal_case"
  ADD COLUMN "claimAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "amendmentAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "interestRequested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "interestStartDate" DATE,
  ADD COLUMN "expectedCollectionAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "opposingAttorneyFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "collectionStatus" "GeneralCollectionStatus" NOT NULL DEFAULT 'NOT_COLLECTED',
  ADD COLUMN "paymentPlan" "GeneralPaymentPlan" NOT NULL DEFAULT 'CASH',
  ADD COLUMN "installmentCount" INTEGER,
  ADD COLUMN "financeDescription" TEXT,
  ADD CONSTRAINT "general_legal_case_claimAmount_check" CHECK ("claimAmount" >= 0),
  ADD CONSTRAINT "general_legal_case_amendmentAmount_check" CHECK ("amendmentAmount" >= 0),
  ADD CONSTRAINT "general_legal_case_expectedCollectionAmount_check" CHECK ("expectedCollectionAmount" >= 0),
  ADD CONSTRAINT "general_legal_case_opposingAttorneyFee_check" CHECK ("opposingAttorneyFee" >= 0),
  ADD CONSTRAINT "general_legal_case_interestStartDate_check" CHECK ("interestRequested" OR "interestStartDate" IS NULL),
  ADD CONSTRAINT "general_legal_case_installmentCount_check" CHECK (
    ("paymentPlan" = 'CASH' AND "installmentCount" IS NULL)
    OR ("paymentPlan" = 'INSTALLMENT' AND "installmentCount" BETWEEN 2 AND 120)
  );

CREATE TABLE "general_case_financial_entry" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "type" "GeneralFinancialEntryType" NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "entryDate" DATE NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "createdById" TEXT NOT NULL,
  "deletedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "general_case_financial_entry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "general_case_financial_entry_amount_check" CHECK ("amount" > 0)
);

CREATE INDEX "general_case_financial_entry_caseId_entryDate_createdAt_idx" ON "general_case_financial_entry"("caseId", "entryDate", "createdAt");
CREATE INDEX "general_case_financial_entry_caseId_deletedAt_idx" ON "general_case_financial_entry"("caseId", "deletedAt");
CREATE INDEX "general_case_financial_entry_createdById_createdAt_idx" ON "general_case_financial_entry"("createdById", "createdAt");

ALTER TABLE "general_case_financial_entry" ADD CONSTRAINT "general_case_financial_entry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "general_legal_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "general_case_financial_entry" ADD CONSTRAINT "general_case_financial_entry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "general_case_financial_entry" ADD CONSTRAINT "general_case_financial_entry_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
