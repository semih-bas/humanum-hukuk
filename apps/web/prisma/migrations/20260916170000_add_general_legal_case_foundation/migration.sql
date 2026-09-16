CREATE TYPE "GeneralCaseKind" AS ENUM ('GENERAL_LITIGATION', 'MEDIATION');
CREATE TYPE "GeneralCaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DECISION', 'APPEAL', 'COMPLETED', 'CLOSED');
CREATE TYPE "GeneralCaseStage" AS ENUM ('CASE_OPENING', 'NOTIFICATION', 'RESPONSE_PETITION', 'PRELIMINARY_REVIEW', 'EXAMINATION', 'EXPERT_REPORT', 'HEARING', 'DECISION', 'APPEAL', 'CASSATION', 'FINALIZATION', 'COLLECTION', 'CLOSED');
CREATE TYPE "GeneralCaseConfidentiality" AS ENUM ('NORMAL', 'RESTRICTED');
CREATE TYPE "GeneralPartyKind" AS ENUM ('INDIVIDUAL', 'ORGANIZATION');
CREATE TYPE "GeneralPartyRole" AS ENUM ('PLAINTIFF', 'DEFENDANT', 'APPLICANT', 'RESPONDENT', 'INTERVENOR', 'THIRD_PARTY', 'RELATED_INSTITUTION');

CREATE SEQUENCE "general_legal_case_reference_sequence" START 1;

CREATE TABLE "general_legal_case" (
  "id" TEXT NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "kind" "GeneralCaseKind" NOT NULL DEFAULT 'GENERAL_LITIGATION',
  "caseType" VARCHAR(100) NOT NULL,
  "subject" TEXT NOT NULL,
  "openingDate" DATE NOT NULL,
  "caseValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "uyapMainNumber" VARCHAR(80),
  "uyapDecisionNumber" VARCHAR(80),
  "courthouse" VARCHAR(150),
  "courtType" VARCHAR(100),
  "court" VARCHAR(150),
  "status" "GeneralCaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "stage" "GeneralCaseStage" NOT NULL DEFAULT 'CASE_OPENING',
  "procedure" VARCHAR(100),
  "urgent" BOOLEAN NOT NULL DEFAULT false,
  "confidentiality" "GeneralCaseConfidentiality" NOT NULL DEFAULT 'NORMAL',
  "estimatedCompletionDate" DATE,
  "trackingGroup" VARCHAR(100),
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "office" VARCHAR(100),
  "description" TEXT,
  "responsibleUserId" TEXT NOT NULL,
  "fileStaffUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "archivedById" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "general_legal_case_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "general_legal_case_caseValue_check" CHECK ("caseValue" >= 0),
  CONSTRAINT "general_legal_case_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "general_case_party" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "role" "GeneralPartyRole" NOT NULL,
  "kind" "GeneralPartyKind" NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "identityOrTaxNumber" VARCHAR(20),
  "phone" VARCHAR(30),
  "email" VARCHAR(254),
  "address" TEXT,
  "representativeUserId" TEXT,
  "representativeName" VARCHAR(200),
  "clientType" VARCHAR(100),
  "description" VARCHAR(500),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "general_case_party_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "general_case_party_sortOrder_check" CHECK ("sortOrder" >= 0)
);

CREATE UNIQUE INDEX "general_legal_case_referenceNumber_key" ON "general_legal_case"("referenceNumber");
CREATE INDEX "general_legal_case_kind_status_idx" ON "general_legal_case"("kind", "status");
CREATE INDEX "general_legal_case_stage_idx" ON "general_legal_case"("stage");
CREATE INDEX "general_legal_case_caseType_idx" ON "general_legal_case"("caseType");
CREATE INDEX "general_legal_case_court_idx" ON "general_legal_case"("court");
CREATE INDEX "general_legal_case_openingDate_idx" ON "general_legal_case"("openingDate");
CREATE INDEX "general_legal_case_responsibleUserId_status_idx" ON "general_legal_case"("responsibleUserId", "status");
CREATE INDEX "general_legal_case_updatedAt_idx" ON "general_legal_case"("updatedAt");
CREATE INDEX "general_legal_case_archivedAt_idx" ON "general_legal_case"("archivedAt");
CREATE INDEX "general_case_party_caseId_role_sortOrder_idx" ON "general_case_party"("caseId", "role", "sortOrder");
CREATE INDEX "general_case_party_identityOrTaxNumber_idx" ON "general_case_party"("identityOrTaxNumber");
CREATE INDEX "general_case_party_name_idx" ON "general_case_party"("name");
CREATE INDEX "general_case_party_representativeUserId_idx" ON "general_case_party"("representativeUserId");

ALTER TABLE "general_legal_case" ADD CONSTRAINT "general_legal_case_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "general_legal_case" ADD CONSTRAINT "general_legal_case_fileStaffUserId_fkey" FOREIGN KEY ("fileStaffUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "general_legal_case" ADD CONSTRAINT "general_legal_case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "general_legal_case" ADD CONSTRAINT "general_legal_case_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "general_legal_case" ADD CONSTRAINT "general_legal_case_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "general_case_party" ADD CONSTRAINT "general_case_party_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "general_legal_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "general_case_party" ADD CONSTRAINT "general_case_party_representativeUserId_fkey" FOREIGN KEY ("representativeUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
