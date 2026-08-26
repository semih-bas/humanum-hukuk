-- CreateEnum
CREATE TYPE "CaseFileStatus" AS ENUM ('OPEN', 'ENFORCEMENT', 'INSTALLMENT', 'PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "DebtorType" AS ENUM ('INSURANCE_COMPANY', 'INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "CaseFileChangeType" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'PARTIALLY_SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "case_file" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "licenseHolder" TEXT NOT NULL,
    "vehiclePlate" TEXT NOT NULL,
    "accidentDate" DATE NOT NULL,
    "debtorType" "DebtorType" NOT NULL,
    "debtorName" TEXT,
    "damageAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depreciationAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "profitLossAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "enforcementOffice" TEXT,
    "enforcementFileNumber" TEXT,
    "vehicleLien" BOOLEAN NOT NULL DEFAULT false,
    "bankLien" BOOLEAN NOT NULL DEFAULT false,
    "titleDeedLien" BOOLEAN NOT NULL DEFAULT false,
    "installmentCount" INTEGER,
    "status" "CaseFileStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_file_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "case_file_required_text_check" CHECK (
        char_length(btrim("referenceNumber")) > 0
        AND char_length(btrim("licenseHolder")) > 0
        AND char_length(btrim("vehiclePlate")) > 0
    ),
    CONSTRAINT "case_file_amounts_nonnegative_check" CHECK (
        "damageAmount" >= 0
        AND "depreciationAmount" >= 0
        AND "profitLossAmount" >= 0
        AND "discountAmount" >= 0
    ),
    CONSTRAINT "case_file_discount_limit_check" CHECK (
        "discountAmount" <= "damageAmount" + "depreciationAmount" + "profitLossAmount"
    ),
    CONSTRAINT "case_file_installment_count_check" CHECK (
        "installmentCount" IS NULL OR "installmentCount" IN (3, 4)
    ),
    CONSTRAINT "case_file_version_check" CHECK ("version" >= 1)
);

-- CreateTable
CREATE TABLE "case_file_change" (
    "id" TEXT NOT NULL,
    "caseFileId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changeType" "CaseFileChangeType" NOT NULL,
    "previousVersion" INTEGER,
    "newVersion" INTEGER NOT NULL,
    "changedFields" JSONB,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_file_change_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "case_file_change_version_check" CHECK (
        "newVersion" >= 1
        AND ("previousVersion" IS NULL OR ("previousVersion" >= 1 AND "newVersion" > "previousVersion"))
    ),
    CONSTRAINT "case_file_change_snapshot_check" CHECK (jsonb_typeof("snapshot") = 'object')
);

-- CreateTable
CREATE TABLE "case_note" (
    "id" TEXT NOT NULL,
    "caseFileId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_note_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "case_note_content_check" CHECK (char_length(btrim("content")) > 0)
);

-- CreateTable
CREATE TABLE "case_document" (
    "id" TEXT NOT NULL,
    "caseFileId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_document_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "case_document_metadata_check" CHECK (
        char_length(btrim("originalName")) > 0
        AND char_length(btrim("storageKey")) > 0
        AND char_length(btrim("mimeType")) > 0
        AND "sizeBytes" > 0
        AND "sha256" ~ '^[0-9a-f]{64}$'
    )
);

-- CreateTable
CREATE TABLE "case_reminder" (
    "id" TEXT NOT NULL,
    "caseFileId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sendEmail" BOOLEAN NOT NULL DEFAULT true,
    "sendSms" BOOLEAN NOT NULL DEFAULT true,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_reminder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "case_reminder_title_check" CHECK (char_length(btrim("title")) > 0),
    CONSTRAINT "case_reminder_channel_check" CHECK ("sendEmail" OR "sendSms")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_file_referenceNumber_key" ON "case_file"("referenceNumber");

-- CreateIndex
CREATE INDEX "case_file_status_idx" ON "case_file"("status");

-- CreateIndex
CREATE INDEX "case_file_vehiclePlate_idx" ON "case_file"("vehiclePlate");

-- CreateIndex
CREATE INDEX "case_file_accidentDate_idx" ON "case_file"("accidentDate");

-- CreateIndex
CREATE INDEX "case_file_debtorName_idx" ON "case_file"("debtorName");

-- CreateIndex
CREATE INDEX "case_file_createdAt_idx" ON "case_file"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "case_file_enforcementOffice_enforcementFileNumber_key" ON "case_file"("enforcementOffice", "enforcementFileNumber");

-- CreateIndex
CREATE INDEX "case_file_change_caseFileId_createdAt_idx" ON "case_file_change"("caseFileId", "createdAt");

-- CreateIndex
CREATE INDEX "case_file_change_changedById_createdAt_idx" ON "case_file_change"("changedById", "createdAt");

-- CreateIndex
CREATE INDEX "case_note_caseFileId_createdAt_idx" ON "case_note"("caseFileId", "createdAt");

-- CreateIndex
CREATE INDEX "case_note_authorId_createdAt_idx" ON "case_note"("authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "case_document_storageKey_key" ON "case_document"("storageKey");

-- CreateIndex
CREATE INDEX "case_document_caseFileId_createdAt_idx" ON "case_document"("caseFileId", "createdAt");

-- CreateIndex
CREATE INDEX "case_document_uploadedById_createdAt_idx" ON "case_document"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "case_reminder_status_dueAt_idx" ON "case_reminder"("status", "dueAt");

-- CreateIndex
CREATE INDEX "case_reminder_caseFileId_dueAt_idx" ON "case_reminder"("caseFileId", "dueAt");

-- CreateIndex
CREATE INDEX "case_reminder_createdById_createdAt_idx" ON "case_reminder"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "case_file" ADD CONSTRAINT "case_file_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_file" ADD CONSTRAINT "case_file_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_file_change" ADD CONSTRAINT "case_file_change_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "case_file"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_file_change" ADD CONSTRAINT "case_file_change_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_note" ADD CONSTRAINT "case_note_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "case_file"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_note" ADD CONSTRAINT "case_note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_document" ADD CONSTRAINT "case_document_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "case_file"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_document" ADD CONSTRAINT "case_document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_reminder" ADD CONSTRAINT "case_reminder_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "case_file"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_reminder" ADD CONSTRAINT "case_reminder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
