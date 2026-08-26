import assert from "node:assert/strict";
import test from "node:test";

import { calculateCaseFinancials, createCaseSchema, updateCaseSchema } from "../src/lib/cases/create-case-input";

const validCase = {
  licenseHolder: "Semih Baş",
  vehiclePlate: "34 ABC 123",
  accidentDate: "2020-01-01",
  debtorType: "INSURANCE_COMPANY",
  debtorName: "Örnek Sigorta A.Ş.",
  damageAmount: "1000.00",
  depreciationAmount: "250.00",
  profitLossAmount: "50.00",
  discountAmount: "100.00",
  enforcementOffice: "İstanbul 1. İcra Dairesi",
  enforcementFileNumber: "2026/123",
  vehicleLien: false,
  bankLien: false,
  titleDeedLien: false,
  installmentCount: null,
  status: "OPEN",
  note: null,
  reminder: null,
} as const;

test("geçerli dosya verisini kabul eder ve finansal değerleri sunucuda hesaplar", () => {
  const result = createCaseSchema.safeParse(validCase);
  assert.equal(result.success, true);
  if (!result.success) return;
  const financials = calculateCaseFinancials(result.data);
  assert.equal(financials.totalClaimAmount.toFixed(2), "1300.00");
  assert.equal(financials.netClaimAmount.toFixed(2), "1200.00");
  assert.equal(financials.monthlyInstallmentAmount, null);
});

test("indirim toplam talep tutarını aşamaz", () => {
  const result = createCaseSchema.safeParse({ ...validCase, discountAmount: "1300.01" });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(result.error.flatten().fieldErrors.discountAmount?.length);
});

test("icra dairesi ve dosya numarası birlikte girilir", () => {
  const result = createCaseSchema.safeParse({ ...validCase, enforcementFileNumber: null });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(result.error.flatten().fieldErrors.enforcementFileNumber?.length);
});

test("taksitli dosyada yalnızca 3 veya 4 ay kullanılabilir", () => {
  const missingCount = createCaseSchema.safeParse({ ...validCase, status: "INSTALLMENT", installmentCount: null });
  const invalidCount = createCaseSchema.safeParse({ ...validCase, status: "INSTALLMENT", installmentCount: 5 });
  assert.equal(missingCount.success, false);
  assert.equal(invalidCount.success, false);
});

test("gelecek kaza tarihini ve kontrol karakterlerini reddeder", () => {
  assert.equal(createCaseSchema.safeParse({ ...validCase, accidentDate: "2999-01-01" }).success, false);
  assert.equal(createCaseSchema.safeParse({ ...validCase, licenseHolder: "Geçersiz\u0000Ad" }).success, false);
});

test("beklenmeyen alanların API modeline girmesine izin vermez", () => {
  assert.equal(createCaseSchema.safeParse({ ...validCase, role: "admin" }).success, false);
  assert.equal(updateCaseSchema.safeParse({ ...validCase, version: 1, id: "forced-id" }).success, false);
});

test("düzenleme sürümü zorunlu ve pozitif tam sayıdır", () => {
  const editableCase = Object.fromEntries(Object.entries(validCase).filter(([key]) => key !== "note" && key !== "reminder"));
  assert.equal(updateCaseSchema.safeParse({ ...editableCase, version: 1 }).success, true);
  assert.equal(updateCaseSchema.safeParse(editableCase).success, false);
  assert.equal(updateCaseSchema.safeParse({ ...editableCase, version: 0 }).success, false);
  assert.equal(updateCaseSchema.safeParse({ ...editableCase, version: 1.5 }).success, false);
});
