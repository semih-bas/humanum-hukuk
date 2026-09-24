export const DEBTOR_TYPES = ["INSURANCE_COMPANY", "INDIVIDUAL", "COMPANY"] as const;

export type DebtorType = typeof DEBTOR_TYPES[number];
export type CaseDebtor = { type: DebtorType; name: string };

const debtorTypeSet = new Set<string>(DEBTOR_TYPES);

export function parseCaseDebtors(value: unknown, fallbackType?: DebtorType, fallbackName?: string | null): CaseDebtor[] {
  if (Array.isArray(value)) {
    const parsed = value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as { type?: unknown; name?: unknown };
      if (typeof candidate.type !== "string" || !debtorTypeSet.has(candidate.type) || typeof candidate.name !== "string" || !candidate.name.trim()) return [];
      return [{ type: candidate.type as DebtorType, name: candidate.name.trim() }];
    });
    if (parsed.length) return parsed;
  }

  return fallbackType && fallbackName?.trim() ? [{ type: fallbackType, name: fallbackName.trim() }] : [];
}

export function debtorTypeLabel(value: DebtorType): string {
  return ({ INSURANCE_COMPANY: "Sigorta Şirketi", INDIVIDUAL: "Şahıs", COMPANY: "Şirket" } as const)[value];
}
