import assert from "node:assert/strict";
import test from "node:test";

import { createGeneralLegalCaseInputSchema, updateGeneralLegalCaseInputSchema } from "../src/lib/general-legal-cases/input";

const party = (role: "PLAINTIFF" | "DEFENDANT" | "APPLICANT" | "RESPONDENT" | "INTERVENOR") => ({
  role,
  kind: "INDIVIDUAL" as const,
  name: role,
  identityOrTaxNumber: null,
  phone: null,
  email: null,
  address: null,
  representativeUserId: null,
  representativeName: null,
  clientType: null,
  description: null,
});

const valid = {
  kind: "GENERAL_LITIGATION" as const,
  caseType: "Tazminat",
  subject: "Maddi ve manevi tazminat talebi",
  openingDate: "2026-09-15",
  caseValue: "325.000,00",
  uyapMainNumber: "2026/184",
  uyapDecisionNumber: null,
  courthouse: "İstanbul Adliyesi",
  courtType: "Asliye Hukuk",
  court: "İstanbul 8. Asliye Hukuk Mahkemesi",
  status: "ACTIVE" as const,
  stage: "CASE_OPENING" as const,
  procedure: null,
  urgent: false,
  confidentiality: "NORMAL" as const,
  estimatedCompletionDate: null,
  trackingGroup: null,
  tags: ["Tazminat", "tazminat"],
  office: "İstanbul Ofisi",
  description: null,
  responsibleUserId: "admin-test",
  fileStaffUserId: null,
  parties: [party("PLAINTIFF"), party("DEFENDANT")],
};

test("genel dava çekirdeğini ve birden fazla taraf rolünü kabul eder", () => {
  const result = createGeneralLegalCaseInputSchema.safeParse(valid);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.caseValue.toFixed(2), "325000.00");
  assert.deepEqual(result.data.tags, ["tazminat"]);
});

test("arabuluculuğu aynı modülde başvuran ve karşı tarafla kabul eder", () => {
  const result = createGeneralLegalCaseInputSchema.safeParse({
    ...valid,
    kind: "MEDIATION",
    caseType: "İhtiyari Arabuluculuk",
    courthouse: null,
    courtType: null,
    court: null,
    parties: [party("APPLICANT"), party("RESPONDENT")],
  });
  assert.equal(result.success, true);
});

test("dosyayı mali özet ve başlangıç hareketleriyle tek seferde kabul eder", () => {
  const result = createGeneralLegalCaseInputSchema.safeParse({
    ...valid,
    finance: {
      claimAmount: "335.000,00", amendmentAmount: "0", interestRequested: false, interestStartDate: null,
      expectedCollectionAmount: "335.000,00", opposingAttorneyFee: "45.000,00",
      paymentPlan: "CASH", installmentCount: null, financeDescription: "Karardan sonra tahsil edilecek.",
    },
    financialEntries: [{ type: "EXPENSE", category: "Başvuru Harcı", entryDate: "2026-09-15", amount: "1.640,00", description: "Başvuru harcı" }],
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.finance?.claimAmount.toFixed(2), "335000.00");
  assert.equal(result.data.financialEntries[0]?.amount.toFixed(2), "1640.00");
});

test("mali özet olmadan başlangıç hareketi oluşturmaz", () => {
  assert.equal(createGeneralLegalCaseInputSchema.safeParse({
    ...valid,
    financialEntries: [{ type: "EXPENSE", category: "Harc", entryDate: "2026-09-15", amount: "100", description: "Başvuru harcı" }],
  }).success, false);
});

test("dosyayı başlangıç süreç işlemi ve duruşmayla tek seferde kabul eder", () => {
  const result = createGeneralLegalCaseInputSchema.safeParse({
    ...valid,
    processEntries: [{
      type: "FILING",
      stage: "CASE_OPENING",
      eventDate: "2026-09-15",
      action: "Dava dilekçesi sunuldu",
      description: "Dilekçe UYAP kaydına işlendi.",
      responsibleUserId: "admin-test",
    }],
    hearings: [{
      startsAt: "2099-10-20T10:30:00.000+03:00",
      court: "İstanbul 8. Asliye Hukuk Mahkemesi",
      hearingType: "Ön inceleme",
      courtroom: "2. Salon",
      attendeeUserId: "admin-test",
      reminderOffsetMinutes: 1440,
      note: null,
      status: "PLANNED",
    }],
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.processEntries[0]?.action, "Dava dilekçesi sunuldu");
  assert.equal(result.data.hearings[0]?.startsAt.toISOString(), "2099-10-20T07:30:00.000Z");
});

test("dosya türüne uygun iki ana taraf bulunmadan kayıt oluşturmaz", () => {
  assert.equal(createGeneralLegalCaseInputSchema.safeParse({ ...valid, parties: [party("PLAINTIFF"), party("INTERVENOR")] }).success, false);
  assert.equal(createGeneralLegalCaseInputSchema.safeParse({ ...valid, kind: "MEDIATION", parties: [party("PLAINTIFF"), party("DEFENDANT")] }).success, false);
});

test("genel dava için mahkeme bilgilerini zorunlu tutar", () => {
  assert.equal(createGeneralLegalCaseInputSchema.safeParse({ ...valid, court: null }).success, false);
});

test("takvimde olmayan ve gelecekteki açılış tarihlerini reddeder", () => {
  assert.equal(createGeneralLegalCaseInputSchema.safeParse({ ...valid, openingDate: "2026-02-31" }).success, false);
  assert.equal(createGeneralLegalCaseInputSchema.safeParse({ ...valid, openingDate: "2099-01-01" }).success, false);
});

test("kapalı durum ile kapalı aşamayı birlikte zorunlu tutar", () => {
  assert.equal(createGeneralLegalCaseInputSchema.safeParse({ ...valid, status: "CLOSED" }).success, false);
  assert.equal(createGeneralLegalCaseInputSchema.safeParse({ ...valid, status: "CLOSED", stage: "CLOSED" }).success, true);
});

test("güncellemede sürüm zorunlu, oluştururken beklenmeyen alan yasaktır", () => {
  assert.equal(updateGeneralLegalCaseInputSchema.safeParse(valid).success, false);
  assert.equal(updateGeneralLegalCaseInputSchema.safeParse({ ...valid, version: 1 }).success, true);
  assert.equal(createGeneralLegalCaseInputSchema.safeParse({ ...valid, unexpected: true }).success, false);
});
