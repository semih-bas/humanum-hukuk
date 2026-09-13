import assert from "node:assert/strict";
import test from "node:test";
import { createTransactionSchema } from "../src/lib/cases/transaction-input";

const valid = { type: "INCOME", category: "PRINCIPAL", transactionDate: "2026-09-13", amount: "1.250,50", description: "Tahsilat", caseNote: "Dosya notu" } as const;

test("gelir/gider kaydını ve Türkçe para biçimini kabul eder", () => {
  const result = createTransactionSchema.safeParse(valid);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.amount.toFixed(2), "1250.50");
});

test("sıfır tutarı ve beklenmeyen alanları reddeder", () => {
  assert.equal(createTransactionSchema.safeParse({ ...valid, amount: "0" }).success, false);
  assert.equal(createTransactionSchema.safeParse({ ...valid, role: "admin" }).success, false);
});

test("gelir ve gider için ayrı kategori kümelerini doğrular", () => {
  assert.equal(createTransactionSchema.safeParse({ ...valid, type: "EXPENSE", category: "FEE" }).success, true);
  assert.equal(createTransactionSchema.safeParse({ ...valid, type: "EXPENSE", category: "ATTORNEY_FEE" }).success, false);
});
