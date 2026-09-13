export const INSURANCE_CASE_TYPE_LABELS = {
  DEPRECIATION: "Değer Kaybı",
  DEPRECIATION_DIFFERENCE: "Değer Kaybı Farkı",
  DAMAGE_DIFFERENCE: "Hasar Farkı",
  ZERO_DAMAGE: "Sıfır Hasar",
} as const;

export const INSURANCE_STATUS_LABELS = {
  INSURANCE_APPLICATION: "Sigorta Başvurusunda",
  SETTLEMENT_REVIEW: "Sulh Değerlendirmesinde",
  ARBITRATION_APPLICATION: "Tahkim Başvurusunda",
  ARBITRATION: "Tahkimde",
  EXPERT_REVIEW: "Bilirkişi Aşamasında",
  PAYMENT_PENDING: "Ödeme Bekleniyor",
  INSURANCE_PAYMENT_RECEIVED: "Sigortadan Ödeme Geldi",
  ENFORCEMENT: "İcrada",
  LITIGATION: "Dava Aşamasında",
  COMPLETED: "Tamamlandı",
  CLOSED: "Kapandı",
} as const;

export type InsuranceCaseType = keyof typeof INSURANCE_CASE_TYPE_LABELS;
export type InsuranceStatus = keyof typeof INSURANCE_STATUS_LABELS;

export function formatDate(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}
