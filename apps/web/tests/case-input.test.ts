import assert from "node:assert/strict";
import test from "node:test";

import { calculateCaseFinancials, createCaseSchema, updateCaseSchema } from "../src/lib/cases/create-case-input";
import { centsToMoneyString } from "../src/lib/form-input";

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

test("taksit sayısı dosya durumundan bağımsız olarak 3, 4, 6, 9 veya 12 olabilir", () => {
  for (const installmentCount of [3, 4, 6, 9, 12] as const) {
    assert.equal(createCaseSchema.safeParse({ ...validCase, status: "OPEN", installmentCount }).success, true);
    assert.equal(createCaseSchema.safeParse({ ...validCase, status: "ENFORCEMENT", installmentCount }).success, true);
  }
  for (const installmentCount of [2, 5, 7, 8, 10, 11] as const) {
    assert.equal(createCaseSchema.safeParse({ ...validCase, installmentCount }).success, false);
  }
  assert.equal(createCaseSchema.safeParse({ ...validCase, status: "INSTALLMENT", installmentCount: null }).success, true);
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

test("plaka zorunlu, normalize edilmiş ve kontrol karakterlerinden arındırılmış olmalıdır", () => {
  const normalized = createCaseSchema.safeParse({ ...validCase, vehiclePlate: "  34   abc  123 " });
  assert.equal(normalized.success, true);
  if (normalized.success) assert.equal(normalized.data.vehiclePlate, "34 ABC 123");
  assert.equal(createCaseSchema.safeParse({ ...validCase, vehiclePlate: "5555555" }).success, true);
  assert.equal(createCaseSchema.safeParse({ ...validCase, vehiclePlate: "1" }).success, true);
  assert.equal(createCaseSchema.safeParse({ ...validCase, vehiclePlate: "34 ABC<script>" }).success, false);
});

test("metin limitleri ve Türkçe para biçimleri alan bazında doğrulanır", () => {
  assert.equal(createCaseSchema.safeParse({ ...validCase, licenseHolder: "a".repeat(151) }).success, false);
  assert.equal(createCaseSchema.safeParse({ ...validCase, note: "a".repeat(2_001) }).success, false);
  const formattedMoney = createCaseSchema.safeParse({ ...validCase, damageAmount: "1.250.000,50" });
  assert.equal(formattedMoney.success, true);
  if (formattedMoney.success) assert.equal(formattedMoney.data.damageAmount.toFixed(2), "1250000.50");
  assert.equal(createCaseSchema.safeParse({ ...validCase, damageAmount: "1.2.3" }).success, false);
});

test("para ayırıcıları Türkçe ve uluslararası girişleri doğru yorumlar", () => {
  const values = [
    ["1250", "1250.00"],
    ["1.250", "1250.00"],
    ["1250,50", "1250.50"],
    ["1250.50", "1250.50"],
    ["1.250,50", "1250.50"],
    ["1,250.50", "1250.50"],
  ] as const;

  for (const [input, expected] of values) {
    const result = createCaseSchema.safeParse({ ...validCase, damageAmount: input });
    assert.equal(result.success, true, input);
    if (result.success) assert.equal(result.data.damageAmount.toFixed(2), expected, input);
  }
  assert.equal(createCaseSchema.safeParse({ ...validCase, damageAmount: "1.2.3" }).success, false);
});

test("BigInt para biçimlendirmesi hassasiyet kaybetmez", () => {
  assert.equal(centsToMoneyString(123456789012345678901n), "1.234.567.890.123.456.789,01");
});

test("taksit hesabı bölünmeyen kuruşu son taksite ekler", () => {
  const result = createCaseSchema.safeParse({ ...validCase, status: "OPEN", installmentCount: 6 });
  assert.equal(result.success, true);
  if (!result.success) return;
  const financials = calculateCaseFinancials(result.data);
  assert.equal(financials.monthlyInstallmentAmount?.toFixed(2), "200.00");
  assert.equal(financials.finalInstallmentAmount?.toFixed(2), "200.00");

  const uneven = createCaseSchema.safeParse({ ...validCase, damageAmount: "1000.01", depreciationAmount: "0", profitLossAmount: "0", discountAmount: "0", installmentCount: 6 });
  assert.equal(uneven.success, true);
  if (uneven.success) {
    const unevenFinancials = calculateCaseFinancials(uneven.data);
    assert.equal(unevenFinancials.monthlyInstallmentAmount?.toFixed(2), "166.66");
    assert.equal(unevenFinancials.finalInstallmentAmount?.toFixed(2), "166.71");
  }
});
