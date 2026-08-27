import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import {
  ENFORCEMENT_FILE_NUMBER_MAX_LENGTH,
  ENFORCEMENT_OFFICE_MAX_LENGTH,
  NOTE_MAX_LENGTH,
  PERSON_OR_COMPANY_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  hasControlCharacter,
  normalizePlate,
  normalizeText,
  parseMoneyToCents,
  validatePlate,
} from "@/lib/form-input";

const MAX_MONEY = new Prisma.Decimal("9999999999999999.99");
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const requiredText = (label: string, maximum: number) => z
  .string({ error: `${label} metin olmalıdır.` })
  .trim()
  .min(1, `${label} zorunludur.`)
  .max(maximum, `${label} en fazla ${maximum} karakter olabilir.`)
  .refine((value) => !hasControlCharacter(value), `${label} geçersiz kontrol karakterleri içeremez.`);

const optionalText = (label: string, maximum: number) => z
  .string({ error: `${label} metin olmalıdır.` })
  .trim()
  .max(maximum, `${label} en fazla ${maximum} karakter olabilir.`)
  .refine((value) => !hasControlCharacter(value), `${label} geçersiz kontrol karakterleri içeremez.`)
  .transform((value) => value || null)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const money = z
  .string({ error: "Tutar metin biçiminde gönderilmelidir." })
  .transform(normalizeText)
  .refine((value) => parseMoneyToCents(value) !== null, "Tutar 0 veya pozitif, en fazla iki ondalık basamak içeren geçerli bir sayı olmalıdır.")
  .transform((value) => {
    const cents = parseMoneyToCents(value) ?? 0n;
    return new Prisma.Decimal(`${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`);
  })
  .refine((value) => value.lte(MAX_MONEY), "Tutar izin verilen üst sınırı aşıyor.");

export const addCaseReminderSchema = z.object({
  title: requiredText("Hatırlatma başlığı", SHORT_TEXT_MAX_LENGTH),
  dueAt: z.iso.datetime({ offset: true, error: "Hatırlatma tarihi geçerli bir tarih-saat olmalıdır." })
    .transform((value) => new Date(value)),
  sendEmail: z.boolean(),
  sendSms: z.boolean(),
}).strict().superRefine((value, context) => {
  if (!value.sendEmail && !value.sendSms) {
    context.addIssue({
      code: "custom",
      path: ["sendEmail"],
      message: "Hatırlatma için e-posta veya SMS seçeneklerinden en az biri seçilmelidir.",
    });
  }

  if (value.dueAt.getTime() <= Date.now()) {
    context.addIssue({
      code: "custom",
      path: ["dueAt"],
      message: "Hatırlatma tarihi gelecekte olmalıdır.",
    });
  }
});

const rawCaseCoreSchema = z.object({
  licenseHolder: requiredText("Ruhsat sahibi", PERSON_OR_COMPANY_MAX_LENGTH),
  vehiclePlate: z.string({ error: "Araç plakası metin olmalıdır." })
    .trim()
    .min(1, "Araç plakası zorunludur.")
    .max(20, "Araç plakası en fazla 20 karakter olabilir.")
    .transform(normalizePlate)
    .superRefine((value, context) => {
      const message = validatePlate(value);
      if (message) context.addIssue({ code: "custom", message });
    }),
  accidentDate: z.string().regex(DATE_PATTERN, "Kaza tarihi YYYY-MM-DD biçiminde olmalıdır."),
  debtorType: z.enum(["INSURANCE_COMPANY", "INDIVIDUAL", "COMPANY"]),
  debtorName: optionalText("Borçlu taraf", PERSON_OR_COMPANY_MAX_LENGTH),
  damageAmount: money,
  depreciationAmount: money,
  profitLossAmount: money,
  discountAmount: money,
  enforcementOffice: optionalText("İcra dairesi", ENFORCEMENT_OFFICE_MAX_LENGTH),
  enforcementFileNumber: optionalText("İcra dosya numarası", ENFORCEMENT_FILE_NUMBER_MAX_LENGTH),
  vehicleLien: z.boolean(),
  bankLien: z.boolean(),
  titleDeedLien: z.boolean(),
  installmentCount: z.union([z.literal(3), z.literal(4), z.null()]),
  status: z.enum(["OPEN", "ENFORCEMENT", "INSTALLMENT", "PENDING", "CLOSED"]),
});

const rawCreateCaseSchema = rawCaseCoreSchema.extend({
  note: optionalText("Not", NOTE_MAX_LENGTH),
  reminder: addCaseReminderSchema.nullable().optional().transform((value) => value ?? null),
}).strict();

export const addCaseNoteSchema = z.object({
  content: requiredText("Not", NOTE_MAX_LENGTH),
}).strict();

type CaseCoreInput = z.infer<typeof rawCaseCoreSchema>;

function validateCaseRules(value: CaseCoreInput, context: z.RefinementCtx) {
  const accidentDate = parseDateOnly(value.accidentDate);

  if (!accidentDate || value.accidentDate > currentIstanbulDate()) {
    context.addIssue({
      code: "custom",
      path: ["accidentDate"],
      message: "Kaza tarihi geçerli ve bugünden ileri olmayan bir tarih olmalıdır.",
    });
  }

  if (Boolean(value.enforcementOffice) !== Boolean(value.enforcementFileNumber)) {
    context.addIssue({
      code: "custom",
      path: value.enforcementOffice ? ["enforcementFileNumber"] : ["enforcementOffice"],
      message: "İcra dairesi ve icra dosya numarası birlikte girilmelidir.",
    });
  }

  if (value.status === "INSTALLMENT" && value.installmentCount === null) {
    context.addIssue({
      code: "custom",
      path: ["installmentCount"],
      message: "Taksitli ödeme durumunda taksit sayısı seçilmelidir.",
    });
  }

  if (value.status !== "INSTALLMENT" && value.installmentCount !== null) {
    context.addIssue({
      code: "custom",
      path: ["installmentCount"],
      message: "Taksit sayısı yalnızca taksitli ödeme durumunda kullanılabilir.",
    });
  }

  if (
    !Prisma.Decimal.isDecimal(value.damageAmount)
    || !Prisma.Decimal.isDecimal(value.depreciationAmount)
    || !Prisma.Decimal.isDecimal(value.profitLossAmount)
    || !Prisma.Decimal.isDecimal(value.discountAmount)
  ) {
    return;
  }

  const total = value.damageAmount.add(value.depreciationAmount).add(value.profitLossAmount);

  if (total.gt(MAX_MONEY)) {
    context.addIssue({
      code: "custom",
      path: ["damageAmount"],
      message: "Toplam talep tutarı izin verilen üst sınırı aşıyor.",
    });
  }

  if (value.discountAmount.gt(total)) {
    context.addIssue({
      code: "custom",
      path: ["discountAmount"],
      message: "İndirim tutarı toplam talep tutarını aşamaz.",
    });
  }
}

export const createCaseSchema = rawCreateCaseSchema.superRefine(validateCaseRules);
export const updateCaseSchema = rawCaseCoreSchema.extend({
  version: z.number({ error: "Dosya sürümü sayı olmalıdır." }).int().min(1).max(2_147_483_647),
}).strict().superRefine(validateCaseRules);

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

export type CaseFinancialSummary = {
  totalClaimAmount: Prisma.Decimal;
  netClaimAmount: Prisma.Decimal;
  monthlyInstallmentAmount: Prisma.Decimal | null;
};

export function normalizeCaseCoreInput<T extends CaseCoreInput>(input: T): T {
  return {
    ...input,
    licenseHolder: normalizeText(input.licenseHolder),
    vehiclePlate: normalizePlate(input.vehiclePlate),
    debtorName: input.debtorName ? normalizeText(input.debtorName) : null,
    enforcementOffice: input.enforcementOffice ? normalizeText(input.enforcementOffice) : null,
    enforcementFileNumber: input.enforcementFileNumber
      ? normalizeText(input.enforcementFileNumber).toLocaleUpperCase("tr-TR")
      : null,
  };
}

export function normalizeCreateCaseInput(input: CreateCaseInput): CreateCaseInput {
  return {
    ...normalizeCaseCoreInput(input),
    note: input.note?.trim() || null,
  };
}

export function calculateCaseFinancials(input: CaseCoreInput): CaseFinancialSummary {
  const totalClaimAmount = input.damageAmount.add(input.depreciationAmount).add(input.profitLossAmount);
  const netClaimAmount = totalClaimAmount.sub(input.discountAmount);
  const monthlyInstallmentAmount = input.installmentCount
    ? netClaimAmount.div(input.installmentCount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : null;

  return { totalClaimAmount, netClaimAmount, monthlyInstallmentAmount };
}

export function parseDateOnly(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function currentIstanbulDate(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

