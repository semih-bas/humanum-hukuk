import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const MAX_MONEY = new Prisma.Decimal("9999999999999999.99");
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

const requiredText = (label: string, maximum: number) => z
  .string({ error: `${label} metin olmalıdır.` })
  .trim()
  .min(1, `${label} zorunludur.`)
  .max(maximum, `${label} en fazla ${maximum} karakter olabilir.`)
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), `${label} geçersiz kontrol karakterleri içeremez.`);

const optionalText = (label: string, maximum: number) => z
  .string({ error: `${label} metin olmalıdır.` })
  .trim()
  .max(maximum, `${label} en fazla ${maximum} karakter olabilir.`)
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), `${label} geçersiz kontrol karakterleri içeremez.`)
  .transform((value) => value || null)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const money = z
  .string({ error: "Tutar metin biçiminde gönderilmelidir." })
  .trim()
  .regex(MONEY_PATTERN, "Tutar en fazla iki ondalık basamak içeren pozitif bir sayı olmalıdır.")
  .transform((value) => new Prisma.Decimal(value))
  .refine((value) => value.lte(MAX_MONEY), "Tutar izin verilen üst sınırı aşıyor.");

const reminderSchema = z.object({
  title: requiredText("Hatırlatma başlığı", 200),
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

const rawCreateCaseSchema = z.object({
  licenseHolder: requiredText("Ruhsat sahibi", 200),
  vehiclePlate: requiredText("Araç plakası", 20),
  accidentDate: z.string().regex(DATE_PATTERN, "Kaza tarihi YYYY-MM-DD biçiminde olmalıdır."),
  debtorType: z.enum(["INSURANCE_COMPANY", "INDIVIDUAL", "COMPANY"]),
  debtorName: optionalText("Borçlu taraf", 200),
  damageAmount: money,
  depreciationAmount: money,
  profitLossAmount: money,
  discountAmount: money,
  enforcementOffice: optionalText("İcra dairesi", 200),
  enforcementFileNumber: optionalText("İcra dosya numarası", 100),
  vehicleLien: z.boolean(),
  bankLien: z.boolean(),
  titleDeedLien: z.boolean(),
  installmentCount: z.union([z.literal(3), z.literal(4), z.null()]),
  status: z.enum(["OPEN", "ENFORCEMENT", "INSTALLMENT", "PENDING", "CLOSED"]),
  note: optionalText("Not", 10_000),
  reminder: reminderSchema.nullable().optional().transform((value) => value ?? null),
}).strict();

export const createCaseSchema = rawCreateCaseSchema.superRefine((value, context) => {
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
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export type CaseFinancialSummary = {
  totalClaimAmount: Prisma.Decimal;
  netClaimAmount: Prisma.Decimal;
  monthlyInstallmentAmount: Prisma.Decimal | null;
};

export function normalizeCreateCaseInput(input: CreateCaseInput): CreateCaseInput {
  return {
    ...input,
    licenseHolder: collapseWhitespace(input.licenseHolder),
    vehiclePlate: collapseWhitespace(input.vehiclePlate).toLocaleUpperCase("tr-TR"),
    debtorName: input.debtorName ? collapseWhitespace(input.debtorName) : null,
    enforcementOffice: input.enforcementOffice ? collapseWhitespace(input.enforcementOffice) : null,
    enforcementFileNumber: input.enforcementFileNumber
      ? collapseWhitespace(input.enforcementFileNumber).toLocaleUpperCase("tr-TR")
      : null,
    note: input.note?.trim() || null,
  };
}

export function calculateCaseFinancials(input: CreateCaseInput): CaseFinancialSummary {
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

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
