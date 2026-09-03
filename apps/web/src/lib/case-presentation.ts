import { centsToMoneyString, parseMoneyToCents } from "./form-input";

export const CASE_STATUS_LABELS = {
  OPEN: "Devam Ediyor",
  ENFORCEMENT: "İcra Takibinde",
  INSTALLMENT: "Taksitli Ödeme",
  PENDING: "Beklemede",
  CLOSED: "Sonuçlandı",
} as const;

export type CaseStatus = keyof typeof CASE_STATUS_LABELS;

const caseDateFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul",
});

// Date-only case fields must not shift according to the browser's time zone.
export function formatCaseDate(value: string): string {
  return caseDateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

export function formatIstanbulDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatMoneyAmount(value: string): string {
  const cents = parseMoneyToCents(value);
  return cents === null ? "0,00" : centsToMoneyString(cents);
}
