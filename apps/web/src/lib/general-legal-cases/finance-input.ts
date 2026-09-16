import { Prisma } from "@/generated/prisma/client";
import { hasControlCharacter, normalizeText, parseMoneyToCents } from "@/lib/form-input";
import { z } from "zod";

import { parseDateOnly } from "./input";

const MAX_MONEY = new Prisma.Decimal("9999999999999999.99");
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const money = (positive = false) => z.union([z.string(), z.number()]).transform((value, context) => {
  const cents = parseMoneyToCents(String(value));
  if (cents === null || (positive && cents === 0n)) {
    context.addIssue({ code: "custom", message: positive ? "Tutar sıfırdan büyük olmalıdır." : "Tutar sıfır veya pozitif olmalıdır." });
    return z.NEVER;
  }
  const result = new Prisma.Decimal(`${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`);
  if (result.gt(MAX_MONEY)) {
    context.addIssue({ code: "custom", message: "Tutar izin verilen üst sınırı aşıyor." });
    return z.NEVER;
  }
  return result;
});

const requiredText = (label: string, maximum: number) => z.string()
  .trim()
  .min(1, `${label} zorunludur.`)
  .max(maximum, `${label} en fazla ${maximum} karakter olabilir.`)
  .refine((value) => !hasControlCharacter(value), `${label} geçersiz karakter içeriyor.`)
  .transform(normalizeText);

const optionalText = (label: string, maximum: number) => z.union([
  z.string().trim().max(maximum, `${label} en fazla ${maximum} karakter olabilir.`)
    .refine((value) => !hasControlCharacter(value), `${label} geçersiz karakter içeriyor.`),
  z.null(),
]).transform((value) => value ? normalizeText(value) : null);

const date = (label: string) => z.string().regex(DATE_PATTERN, `${label} YYYY-MM-DD biçiminde olmalıdır.`)
  .refine((value) => parseDateOnly(value) !== null, `${label} geçerli bir takvim tarihi olmalıdır.`);

const optionalDate = (label: string) => z.union([date(label), z.literal(""), z.null()]).transform((value) => value || null);
const version = z.number().int().min(1).max(2_147_483_647);

export const generalCaseFinanceSummarySchema = z.object({
  version,
  claimAmount: money(),
  amendmentAmount: money(),
  interestRequested: z.boolean(),
  interestStartDate: optionalDate("Faiz başlangıç tarihi"),
  expectedCollectionAmount: money(),
  opposingAttorneyFee: money(),
  paymentPlan: z.enum(["CASH", "INSTALLMENT"]),
  installmentCount: z.number().int().min(2).max(120).nullable(),
  financeDescription: optionalText("Mali açıklama", 4_000),
}).strict().superRefine((value, context) => {
  if (value.interestRequested && !value.interestStartDate) {
    context.addIssue({ code: "custom", path: ["interestStartDate"], message: "Faiz talep ediliyorsa başlangıç tarihi zorunludur." });
  }
  if (!value.interestRequested && value.interestStartDate) {
    context.addIssue({ code: "custom", path: ["interestStartDate"], message: "Faiz talebi yoksa başlangıç tarihi girilemez." });
  }
  if ((value.paymentPlan === "INSTALLMENT") !== (value.installmentCount !== null)) {
    context.addIssue({ code: "custom", path: ["installmentCount"], message: "Taksitli planda geçerli bir taksit sayısı seçilmelidir." });
  }
});

const rawEntrySchema = z.object({
  type: z.enum(["EXPENSE", "COLLECTION", "PAYMENT"]),
  category: requiredText("Kategori", 100),
  entryDate: date("İşlem tarihi"),
  amount: money(true),
  description: requiredText("Açıklama", 500),
}).strict();

export const createGeneralCaseFinancialEntrySchema = rawEntrySchema;
export const updateGeneralCaseFinancialEntrySchema = rawEntrySchema.extend({ version }).strict();

export type GeneralCaseFinanceSummaryInput = z.infer<typeof generalCaseFinanceSummarySchema>;
export type CreateGeneralCaseFinancialEntryInput = z.infer<typeof createGeneralCaseFinancialEntrySchema>;
export type UpdateGeneralCaseFinancialEntryInput = z.infer<typeof updateGeneralCaseFinancialEntrySchema>;
