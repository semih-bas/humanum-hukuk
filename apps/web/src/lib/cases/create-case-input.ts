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
  INSTALLMENT_OPTIONS,
} from "@/lib/form-input";

export type InstallmentCount = typeof INSTALLMENT_OPTIONS[number];

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

const optionalMoney = z.union([money, z.null()]).optional().transform((value) => value ?? null);

export const addCaseReminderSchema = z.object({
  title: requiredText("Hatırlatma başlığı", SHORT_TEXT_MAX_LENGTH),
  dueAt: z.iso.datetime({ offset: true, error: "Hatırlatma tarihi geçerli bir tarih-saat olmalıdır." })
    .transform((value) => new Date(value)),
  sendEmail: z.literal(true).optional().default(true),
  sendSms: z.literal(false).optional().default(false),
}).strict().superRefine((value, context) => {
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
  installmentCount: z.union(INSTALLMENT_OPTIONS.map((count) => z.literal(count)) as [z.ZodLiteral<InstallmentCount>, ...z.ZodLiteral<InstallmentCount>[]]).nullable(),
  status: z.enum(["OPEN", "ENFORCEMENT", "INSTALLMENT", "PENDING", "CLOSED"]),
});

const editableCaseFields = {
  hasDamageClaim: z.boolean(),
  hasDepreciationClaim: z.boolean(),
  hasProfitLossClaim: z.boolean(),
  profitLossDays: z.number().int().min(1).max(36_500).nullable(),
  dailyRentalAmount: optionalMoney,
  judgmentStatus: z.enum(["WITHOUT_JUDGMENT", "WITH_JUDGMENT"]),
  salaryLien: z.boolean(),
};

const rawEditableCaseSchema = rawCaseCoreSchema.extend(editableCaseFields);

const rawCreateCaseSchema = rawEditableCaseSchema.extend({
  note: optionalText("Not", NOTE_MAX_LENGTH),
  reminder: addCaseReminderSchema.nullable().optional().transform((value) => value ?? null),
}).strict();

export const addCaseNoteSchema = z.object({
  content: requiredText("Not", NOTE_MAX_LENGTH),
}).strict();

type CaseCoreInput = z.infer<typeof rawCaseCoreSchema>;
type EditableCaseInput = z.infer<typeof rawEditableCaseSchema>;

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

function validateEditableCaseRules(value: EditableCaseInput, context: z.RefinementCtx) {
  if (!value.hasDamageClaim && !value.hasDepreciationClaim && !value.hasProfitLossClaim) {
    context.addIssue({ code: "custom", path: ["hasDamageClaim"], message: "En az bir dosya türü seçilmelidir." });
  }

  if (!value.hasDamageClaim && !value.damageAmount.isZero()) {
    context.addIssue({ code: "custom", path: ["damageAmount"], message: "Hasar bedeli seçili değilken tutar sıfır olmalıdır." });
  }
  if (!value.hasDepreciationClaim && !value.depreciationAmount.isZero()) {
    context.addIssue({ code: "custom", path: ["depreciationAmount"], message: "Değer kaybı seçili değilken tutar sıfır olmalıdır." });
  }

  if (value.hasProfitLossClaim) {
    if (!value.profitLossDays) {
      context.addIssue({ code: "custom", path: ["profitLossDays"], message: "Kazanç kaybı için gün sayısı zorunludur." });
    }
    if (!value.dailyRentalAmount || value.dailyRentalAmount.isZero()) {
      context.addIssue({ code: "custom", path: ["dailyRentalAmount"], message: "Kazanç kaybı için günlük kira bedeli zorunludur." });
    }
    if (value.profitLossDays && value.dailyRentalAmount) {
      const expected = value.dailyRentalAmount.mul(value.profitLossDays);
      if (!value.profitLossAmount.equals(expected)) {
        context.addIssue({ code: "custom", path: ["profitLossAmount"], message: "Kazanç kaybı gün sayısı ile günlük kira bedelinin çarpımına eşit olmalıdır." });
      }
    }
  } else if (!value.profitLossAmount.isZero() || value.profitLossDays || value.dailyRentalAmount) {
    context.addIssue({ code: "custom", path: ["profitLossAmount"], message: "Kazanç kaybı seçili değilken hesaplama alanları boş olmalıdır." });
  }
}

export const createCaseSchema = rawCreateCaseSchema.superRefine((value, context) => {
  validateCaseRules(value, context);
  validateEditableCaseRules(value, context);
});
export const updateCaseSchema = rawEditableCaseSchema.extend({
  version: z.number({ error: "Dosya sürümü sayı olmalıdır." }).int().min(1).max(2_147_483_647),
}).strict().superRefine((value, context) => {
  validateCaseRules(value, context);
  validateEditableCaseRules(value, context);
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

export type CaseFinancialSummary = {
  totalClaimAmount: Prisma.Decimal;
  netClaimAmount: Prisma.Decimal;
  monthlyInstallmentAmount: Prisma.Decimal | null;
  finalInstallmentAmount: Prisma.Decimal | null;
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
  const installmentCents = input.installmentCount ? BigInt(netClaimAmount.toFixed(2).replace(".", "")) : 0n;
  const monthlyCents = input.installmentCount ? installmentCents / BigInt(input.installmentCount) : 0n;
  const remainderCents = input.installmentCount ? installmentCents % BigInt(input.installmentCount) : 0n;
  const monthlyInstallmentAmount = input.installmentCount ? centsToDecimal(monthlyCents) : null;
  const finalInstallmentAmount = input.installmentCount ? centsToDecimal(monthlyCents + remainderCents) : null;

  return { totalClaimAmount, netClaimAmount, monthlyInstallmentAmount, finalInstallmentAmount };
}

function centsToDecimal(cents: bigint): Prisma.Decimal {
  return new Prisma.Decimal(`${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`);
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
