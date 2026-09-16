ALTER TABLE "general_case_financial_entry"
  ADD COLUMN "updatedById" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "general_case_financial_entry"
SET "updatedById" = "createdById"
WHERE "updatedById" IS NULL;

ALTER TABLE "general_case_financial_entry"
  ALTER COLUMN "updatedById" SET NOT NULL,
  ADD CONSTRAINT "general_case_financial_entry_version_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "general_case_financial_entry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
