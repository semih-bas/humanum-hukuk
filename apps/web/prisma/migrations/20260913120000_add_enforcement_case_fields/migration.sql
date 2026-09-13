CREATE TYPE "JudgmentStatus" AS ENUM ('WITHOUT_JUDGMENT', 'WITH_JUDGMENT');

ALTER TABLE "case_file"
  ADD COLUMN "hasDamageClaim" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hasDepreciationClaim" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hasProfitLossClaim" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "profitLossDays" INTEGER,
  ADD COLUMN "dailyRentalAmount" DECIMAL(18,2),
  ADD COLUMN "judgmentStatus" "JudgmentStatus" NOT NULL DEFAULT 'WITHOUT_JUDGMENT',
  ADD COLUMN "salaryLien" BOOLEAN NOT NULL DEFAULT false;

UPDATE "case_file"
SET
  "hasDamageClaim" = "damageAmount" > 0,
  "hasDepreciationClaim" = "depreciationAmount" > 0,
  "hasProfitLossClaim" = "profitLossAmount" > 0;

ALTER TABLE "case_file"
  ADD CONSTRAINT "case_file_profit_loss_days_check"
    CHECK ("profitLossDays" IS NULL OR "profitLossDays" BETWEEN 1 AND 36500),
  ADD CONSTRAINT "case_file_daily_rental_amount_check"
    CHECK ("dailyRentalAmount" IS NULL OR "dailyRentalAmount" >= 0);
