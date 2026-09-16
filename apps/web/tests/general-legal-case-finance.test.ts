import assert from "node:assert/strict";
import test from "node:test";

import { calculateGeneralCaseFinanceTotals, splitGeneralCaseInstallments } from "../src/lib/general-legal-cases/finance-calculations";

test("masraf, tahsilat ve ödemeyi birbirine karıştırmadan toplar", () => {
  const totals = calculateGeneralCaseFinanceTotals(335_000_00n, [
    { type: "EXPENSE", amountCents: 1_640_00n },
    { type: "EXPENSE", amountCents: 1_200_00n },
    { type: "COLLECTION", amountCents: 50_000_00n },
    { type: "PAYMENT", amountCents: 2_500_00n },
    { type: "COLLECTION", amountCents: 10_000_00n, deleted: true },
  ]);

  assert.deepEqual(totals, {
    expenseCents: 2_840_00n,
    collectionCents: 50_000_00n,
    paymentCents: 2_500_00n,
    remainingReceivableCents: 285_000_00n,
  });
});

test("fazla tahsilatta kalan alacağı negatif göstermez", () => {
  const totals = calculateGeneralCaseFinanceTotals(1_000n, [{ type: "COLLECTION", amountCents: 1_001n }]);
  assert.equal(totals.remainingReceivableCents, 0n);
});

test("taksitleri kuruş kaybetmeden böler ve farkı son taksite ekler", () => {
  const installments = splitGeneralCaseInstallments(10_00n, 3);
  assert.deepEqual(installments, [333n, 333n, 334n]);
  assert.equal(installments.reduce((sum, amount) => sum + amount, 0n), 10_00n);
});

test("geçersiz para ve taksit değerlerini reddeder", () => {
  assert.throws(() => calculateGeneralCaseFinanceTotals(-1n, []), RangeError);
  assert.throws(() => calculateGeneralCaseFinanceTotals(1_000n, [{ type: "EXPENSE", amountCents: 0n }]), RangeError);
  assert.throws(() => splitGeneralCaseInstallments(0n, 3), RangeError);
  assert.throws(() => splitGeneralCaseInstallments(1_000n, 1), RangeError);
  assert.throws(() => splitGeneralCaseInstallments(1_000n, 121), RangeError);
});
