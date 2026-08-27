ALTER TABLE "case_file"
DROP CONSTRAINT "case_file_installment_count_check";

ALTER TABLE "case_file"
ADD CONSTRAINT "case_file_installment_count_check" CHECK (
    "installmentCount" IS NULL OR "installmentCount" IN (3, 4, 6, 9, 12)
);
