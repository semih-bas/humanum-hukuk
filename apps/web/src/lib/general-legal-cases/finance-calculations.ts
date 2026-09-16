export type GeneralFinancialEntryForCalculation = {
  type: "EXPENSE" | "COLLECTION" | "PAYMENT";
  amountCents: bigint;
  deleted?: boolean;
};

export type GeneralCaseFinanceTotals = {
  expenseCents: bigint;
  collectionCents: bigint;
  paymentCents: bigint;
  remainingReceivableCents: bigint;
};

export function calculateGeneralCaseFinanceTotals(
  expectedCollectionCents: bigint,
  entries: readonly GeneralFinancialEntryForCalculation[],
): GeneralCaseFinanceTotals {
  if (expectedCollectionCents < 0n) throw new RangeError("Beklenen tahsilat negatif olamaz.");

  let expenseCents = 0n;
  let collectionCents = 0n;
  let paymentCents = 0n;

  for (const entry of entries) {
    if (entry.deleted) continue;
    if (entry.amountCents <= 0n) throw new RangeError("Mali hareket tutarı sıfırdan büyük olmalıdır.");

    if (entry.type === "EXPENSE") expenseCents += entry.amountCents;
    else if (entry.type === "COLLECTION") collectionCents += entry.amountCents;
    else paymentCents += entry.amountCents;
  }

  return {
    expenseCents,
    collectionCents,
    paymentCents,
    remainingReceivableCents: maxBigInt(expectedCollectionCents - collectionCents, 0n),
  };
}

export function splitGeneralCaseInstallments(totalCents: bigint, installmentCount: number): bigint[] {
  if (totalCents <= 0n) throw new RangeError("Taksitlendirilecek tutar sıfırdan büyük olmalıdır.");
  if (!Number.isInteger(installmentCount) || installmentCount < 2 || installmentCount > 120) {
    throw new RangeError("Taksit sayısı 2 ile 120 arasında olmalıdır.");
  }

  const count = BigInt(installmentCount);
  const regularInstallment = totalCents / count;
  const finalRemainder = totalCents % count;
  const installments = Array<bigint>(installmentCount).fill(regularInstallment);
  installments[installments.length - 1] += finalRemainder;
  return installments;
}

function maxBigInt(left: bigint, right: bigint) {
  return left > right ? left : right;
}
