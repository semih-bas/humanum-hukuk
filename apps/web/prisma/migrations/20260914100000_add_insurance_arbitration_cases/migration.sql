CREATE TYPE "InsuranceCaseType" AS ENUM ('DEPRECIATION', 'DEPRECIATION_DIFFERENCE', 'DAMAGE_DIFFERENCE', 'ZERO_DAMAGE');
CREATE TYPE "InsuranceArbitrationStatus" AS ENUM ('INSURANCE_APPLICATION', 'SETTLEMENT_REVIEW', 'ARBITRATION_APPLICATION', 'ARBITRATION', 'EXPERT_REVIEW', 'PAYMENT_PENDING', 'INSURANCE_PAYMENT_RECEIVED', 'ENFORCEMENT', 'LITIGATION', 'COMPLETED', 'CLOSED');

CREATE SEQUENCE "insurance_arbitration_reference_sequence" AS BIGINT START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE "insurance_arbitration_case" (
  "id" TEXT NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "arbitrationApplicationNo" TEXT,
  "opposingInsuranceCompany" TEXT NOT NULL,
  "opposingPolicyNumber" TEXT,
  "policyExpiryDate" DATE,
  "opposingVehicleOwner" TEXT,
  "opposingIdentityNumber" TEXT,
  "vehicleOwner" TEXT NOT NULL,
  "identityNumber" TEXT,
  "vehiclePlate" TEXT NOT NULL,
  "accidentDate" DATE NOT NULL,
  "postalDeliveryDate" DATE,
  "caseType" "InsuranceCaseType" NOT NULL,
  "insuranceApplicationDate" DATE,
  "insuranceSettlementOffer" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "arbitrationApplicationDate" DATE,
  "hasArbitration" BOOLEAN NOT NULL DEFAULT false,
  "arbitrationCaseNumber" TEXT,
  "status" "InsuranceArbitrationStatus" NOT NULL DEFAULT 'INSURANCE_APPLICATION',
  "postageExpense" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "enforcementExpense" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "arbitrationApplicationFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "expertFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "postalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "actualDepreciationAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "insurance_arbitration_case_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "insurance_arbitration_amounts_check" CHECK ("insuranceSettlementOffer" >= 0 AND "postageExpense" >= 0 AND "enforcementExpense" >= 0 AND "arbitrationApplicationFee" >= 0 AND "expertFee" >= 0 AND "postalAmount" >= 0 AND "actualDepreciationAmount" >= 0)
);

CREATE UNIQUE INDEX "insurance_arbitration_case_referenceNumber_key" ON "insurance_arbitration_case"("referenceNumber");
CREATE UNIQUE INDEX "insurance_arbitration_case_arbitrationApplicationNo_key" ON "insurance_arbitration_case"("arbitrationApplicationNo");
CREATE INDEX "insurance_arbitration_case_vehiclePlate_idx" ON "insurance_arbitration_case"("vehiclePlate");
CREATE INDEX "insurance_arbitration_case_opposingInsuranceCompany_idx" ON "insurance_arbitration_case"("opposingInsuranceCompany");
CREATE INDEX "insurance_arbitration_case_accidentDate_idx" ON "insurance_arbitration_case"("accidentDate");
CREATE INDEX "insurance_arbitration_case_status_idx" ON "insurance_arbitration_case"("status");
CREATE INDEX "insurance_arbitration_case_updatedAt_idx" ON "insurance_arbitration_case"("updatedAt");

ALTER TABLE "insurance_arbitration_case" ADD CONSTRAINT "insurance_arbitration_case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "insurance_arbitration_case" ADD CONSTRAINT "insurance_arbitration_case_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "insurance_arbitration_case" TO humanum_app;
GRANT USAGE, SELECT ON SEQUENCE "insurance_arbitration_reference_sequence" TO humanum_app;
