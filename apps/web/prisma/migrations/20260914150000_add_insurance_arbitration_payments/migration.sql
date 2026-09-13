CREATE TYPE "InsurancePaymentType" AS ENUM ('OUTGOING_PAYMENT', 'INSURANCE_INCOME', 'ARBITRATION_INCOME', 'ENFORCEMENT_INCOME');

CREATE TABLE "insurance_arbitration_payment" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "type" "InsurancePaymentType" NOT NULL,
  "paymentDate" DATE NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "commission" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "clientAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "description" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "insurance_arbitration_payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "insurance_arbitration_payment_caseId_paymentDate_createdAt_idx" ON "insurance_arbitration_payment"("caseId", "paymentDate", "createdAt");
ALTER TABLE "insurance_arbitration_payment" ADD CONSTRAINT "insurance_arbitration_payment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "insurance_arbitration_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
