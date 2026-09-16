import assert from "node:assert/strict";
import test from "node:test";

import {
  createGeneralCaseHearingSchema,
  createGeneralCaseProcessEntrySchema,
  updateGeneralCaseHearingSchema,
  updateGeneralCaseProcessEntrySchema,
} from "../src/lib/general-legal-cases/process-input";

test("dava süreci işlemini aşama ve sorumluyla kabul eder", () => {
  const input = { type: "FILING", stage: "RESPONSE_PETITION", eventDate: "2026-09-16", action: "Cevap dilekçesi alındı", description: "İncelemeye eklendi.", responsibleUserId: "admin-test" } as const;
  assert.equal(createGeneralCaseProcessEntrySchema.safeParse(input).success, true);
  assert.equal(updateGeneralCaseProcessEntrySchema.safeParse(input).success, false);
  assert.equal(updateGeneralCaseProcessEntrySchema.safeParse({ ...input, version: 1 }).success, true);
});

test("geçersiz ve gelecekteki süreç tarihlerini reddeder", () => {
  const input = { type: "OTHER", stage: "CASE_OPENING", action: "İşlem", description: null, responsibleUserId: null } as const;
  assert.equal(createGeneralCaseProcessEntrySchema.safeParse({ ...input, eventDate: "2026-02-31" }).success, false);
  assert.equal(createGeneralCaseProcessEntrySchema.safeParse({ ...input, eventDate: "2099-01-01" }).success, false);
});

test("gelecekteki planlı duruşmayı ve hatırlatma süresini kabul eder", () => {
  const input = { startsAt: "2099-10-20T07:30:00.000Z", court: "İstanbul 8. Asliye Hukuk Mahkemesi", hearingType: "Tahkikat", courtroom: "2. Salon", attendeeUserId: "admin-test", reminderOffsetMinutes: 1_440, note: "Bilirkişi raporu sunulacak.", status: "PLANNED" } as const;
  const result = createGeneralCaseHearingSchema.safeParse(input);
  assert.equal(result.success, true);
  assert.equal(updateGeneralCaseHearingSchema.safeParse(input).success, false);
  assert.equal(updateGeneralCaseHearingSchema.safeParse({ ...input, version: 1 }).success, true);
});

test("geçmişte kalan duruşmayı planlandı durumunda kabul etmez", () => {
  const input = { startsAt: "2020-01-01T10:00:00.000Z", court: "Mahkeme", hearingType: "Duruşma", courtroom: null, attendeeUserId: null, reminderOffsetMinutes: null, note: null, status: "PLANNED" } as const;
  assert.equal(createGeneralCaseHearingSchema.safeParse(input).success, false);
  assert.equal(createGeneralCaseHearingSchema.safeParse({ ...input, status: "COMPLETED" }).success, true);
});
