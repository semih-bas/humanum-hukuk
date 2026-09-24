ALTER TABLE "case_file"
ADD COLUMN "preEnforcementInterestAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "postEnforcementInterestAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "case_file"
DROP CONSTRAINT "case_file_amounts_nonnegative_check",
DROP CONSTRAINT "case_file_discount_limit_check";

ALTER TABLE "case_file"
ADD CONSTRAINT "case_file_amounts_nonnegative_check" CHECK (
  "damageAmount" >= 0
  AND "depreciationAmount" >= 0
  AND "profitLossAmount" >= 0
  AND "preEnforcementInterestAmount" >= 0
  AND "postEnforcementInterestAmount" >= 0
  AND "discountAmount" >= 0
),
ADD CONSTRAINT "case_file_discount_limit_check" CHECK (
  "discountAmount" <= "damageAmount" + "depreciationAmount" + "profitLossAmount"
    + "preEnforcementInterestAmount" + "postEnforcementInterestAmount"
);
