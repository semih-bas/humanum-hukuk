export const INSTALLMENT_OPTIONS = [3, 4, 6, 9, 12] as const;

export const PLATE_MAX_LENGTH = 20;
export const PERSON_OR_COMPANY_MAX_LENGTH = 150;
export const ENFORCEMENT_OFFICE_MAX_LENGTH = 150;
export const ENFORCEMENT_FILE_NUMBER_MAX_LENGTH = 50;
export const SHORT_TEXT_MAX_LENGTH = 500;
export const NOTE_MAX_LENGTH = 2_000;
export const MONEY_MAX_CENTS = 999999999999999999n;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const PLATE_ALLOWED_PATTERN = /^[\p{L}\p{N} ./-]+$/u;
const MONEY_ALLOWED_PATTERN = /^\d[\d.,]*$/;

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizePlate(value: string): string {
  return normalizeText(value).toLocaleUpperCase("tr-TR");
}

export function validatePlate(value: string): string | null {
  const normalized = normalizePlate(value);
  if (!normalized || normalized.length > PLATE_MAX_LENGTH) {
    return normalized ? `Araç plakası en fazla ${PLATE_MAX_LENGTH} karakter olabilir.` : "Araç plakası zorunludur.";
  }
  if (CONTROL_CHARACTER_PATTERN.test(normalized) || !PLATE_ALLOWED_PATTERN.test(normalized)) {
    return "Araç plakası yalnızca harf, rakam, boşluk ve geçerli plaka ayırıcıları içerebilir.";
  }
  return null;
}

export function parseMoneyToCents(value: string): bigint | null {
  const normalized = normalizeText(value);
  if (!normalized || !MONEY_ALLOWED_PATTERN.test(normalized)) return null;

  const separators = [...normalized.matchAll(/[.,]/g)].map((match) => match.index ?? -1);
  let integerPart = normalized;
  let fractionPart = "";
  if (separators.length) {
    const lastSeparator = separators[separators.length - 1];
    const afterLast = normalized.slice(lastSeparator + 1);
    const prefix = normalized.slice(0, lastSeparator);
    const decimalSeparator = afterLast.length <= 2 && (separators.length > 1 || afterLast.length !== 3);
    if (decimalSeparator && afterLast.length > 0) {
      integerPart = normalized.slice(0, lastSeparator);
      fractionPart = afterLast;
    } else if (afterLast.length === 3) {
      integerPart = normalized;
    } else if (afterLast.length === 0 || !/^\d+$/.test(prefix)) {
      return null;
    }
  }

  if (separators.length > 1 && !/^\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?$/.test(normalized)) return null;
  integerPart = integerPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(integerPart) || !/^\d{0,2}$/.test(fractionPart)) return null;
  const cents = BigInt(integerPart) * 100n + BigInt(fractionPart.padEnd(2, "0") || "0");
  return cents <= MONEY_MAX_CENTS ? cents : null;
}

export function centsToMoneyString(cents: bigint): string {
  const whole = (cents / 100n).toString();
  const fraction = (cents % 100n).toString().padStart(2, "0");
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${groupedWhole},${fraction}`;
}

export function hasControlCharacter(value: string): boolean {
  return CONTROL_CHARACTER_PATTERN.test(value);
}
