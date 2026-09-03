import assert from "node:assert/strict";
import test from "node:test";
import { CASE_STATUS_LABELS, formatCaseDate, formatIstanbulDateTime, formatMoneyAmount } from "../src/lib/case-presentation";

test("shared case labels preserve all existing filter and badge labels", () => {
  assert.deepEqual(CASE_STATUS_LABELS, { OPEN: "Devam Ediyor", ENFORCEMENT: "İcra Takibinde", INSTALLMENT: "Taksitli Ödeme", PENDING: "Beklemede", CLOSED: "Sonuçlandı" });
});

test("date-only case fields stay on the same day and timestamps use Istanbul", () => {
  assert.equal(formatCaseDate("2026-01-01"), "01.01.2026");
  assert.equal(formatCaseDate("2024-02-29"), "29.02.2024");
  const timestamp = "2026-09-03T22:30:00Z";
  assert.equal(formatIstanbulDateTime(timestamp), new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp)));
  assert.ok(formatIstanbulDateTime(timestamp).includes("01:30"));
});

test("shared money presentation keeps precision, separators and invalid-value fallback", () => {
  assert.equal(formatMoneyAmount("1000.01"), "1.000,01");
  assert.equal(formatMoneyAmount("9999999999999999.99"), "9.999.999.999.999.999,99");
  assert.equal(formatMoneyAmount("invalid"), "0,00");
});
