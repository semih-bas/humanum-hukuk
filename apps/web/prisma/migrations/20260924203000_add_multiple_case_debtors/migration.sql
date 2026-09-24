ALTER TABLE "case_file"
ADD COLUMN "debtors" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "case_file"
SET "debtors" = jsonb_build_array(
  jsonb_build_object(
    'type', "debtorType"::text,
    'name', "debtorName"
  )
)
WHERE "debtorName" IS NOT NULL
  AND btrim("debtorName") <> '';

ALTER TABLE "case_file"
DROP CONSTRAINT "case_file_installment_count_check";

ALTER TABLE "case_file"
ADD CONSTRAINT "case_file_installment_count_check" CHECK (
  "installmentCount" IS NULL OR "installmentCount" BETWEEN 1 AND 12
);
