import assert from "node:assert/strict";
import test from "node:test";

import {
  createGeneralCaseFinancialEntrySchema,
  generalCaseFinanceSummarySchema,
  updateGeneralCaseFinancialEntrySchema,
} from "../src/lib/general-legal-cases/finance-input";

const summary = {
  version: 1,
  claimAmount: "335.000,00",
  amendmentAmount: "0",
  interestRequested: true,
  interestStartDate: "2026-09-16",
  expectedCollectionAmount: "335.000,00",
  opposingAttorneyFee: "45.000,00",
  paymentPlan: "INSTALLMENT" as const,
  installmentCount: 3,
  financeDescription: "Tahsilat karardan sonra yapılacak.",
};

test("mali özette Türkçe para, faiz ve taksit bilgisini kabul eder", () => {
  const result = generalCaseFinanceSummarySchema.safeParse(summary);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.claimAmount.toFixed(2), "335000.00");
});

test("faiz tarihi ile taksit sayısını seçilen plana bağlı doğrular", () => {
  assert.equal(generalCaseFinanceSummarySchema.safeParse({ ...summary, interestStartDate: null }).success, false);
  assert.equal(generalCaseFinanceSummarySchema.safeParse({ ...summary, interestRequested: false }).success, false);
  assert.equal(generalCaseFinanceSummarySchema.safeParse({ ...summary, paymentPlan: "CASH" }).success, false);
  assert.equal(generalCaseFinanceSummarySchema.safeParse({ ...summary, paymentPlan: "CASH", installmentCount: null }).success, true);
});

test("mali hareket tutarını ve düzenleme sürümünü doğrular", () => {
  const entry = { type: "EXPENSE" as const, category: "Başvuru Harcı", entryDate: "2026-09-16", amount: "1.640,00", description: "Başvuru harcı" };
  assert.equal(createGeneralCaseFinancialEntrySchema.safeParse(entry).success, true);
  assert.equal(createGeneralCaseFinancialEntrySchema.safeParse({ ...entry, amount: "0" }).success, false);
  assert.equal(updateGeneralCaseFinancialEntrySchema.safeParse(entry).success, false);
  assert.equal(updateGeneralCaseFinancialEntrySchema.safeParse({ ...entry, version: 1 }).success, true);
  assert.equal(createGeneralCaseFinancialEntrySchema.safeParse({ ...entry, unexpected: true }).success, false);
});
