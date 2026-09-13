import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { hasControlCharacter, normalizeText, parseMoneyToCents } from "@/lib/form-input";

const incomeCategories = ["PRINCIPAL", "PRE_FOLLOW_UP_INTEREST", "POST_FOLLOW_UP_INTEREST", "ATTORNEY_FEE", "EXPENSE_REFUND", "LITIGATION_EXPENSE", "PENALTY_COMPENSATION", "OTHER_INCOME"] as const;
const expenseCategories = ["FEE", "NOTIFICATION", "EXPERT_FEE", "ATTORNEY_PAYMENT", "EXPENSE", "PRISON_FEE", "COLLECTION_FEE", "OTHER_EXPENSE"] as const;
const categories = [...incomeCategories, ...expenseCategories] as const;

const money = z.string().transform(normalizeText).refine((value) => {
  const cents = parseMoneyToCents(value);
  return cents !== null && cents > 0n;
}, "Tutar sıfırdan büyük olmalıdır.").transform((value) => {
  const cents = parseMoneyToCents(value)!;
  return new Prisma.Decimal(`${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`);
}).refine((value) => value.lte("9999999999999999.99"), "Tutar izin verilen üst sınırı aşıyor.");

const text = (label: string, max: number) => z.string().trim().min(1, `${label} zorunludur.`).max(max, `${label} en fazla ${max} karakter olabilir.`).refine((value) => !hasControlCharacter(value), `${label} geçersiz karakter içeriyor.`);

export const createTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.enum(categories),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçerli değildir."),
  amount: money,
  description: text("Açıklama", 500),
  caseNote: z.string().trim().max(2_000, "Not en fazla 2000 karakter olabilir.").refine((value) => !hasControlCharacter(value), "Not geçersiz karakter içeriyor.").nullable().optional(),
}).strict().superRefine((value, context) => {
  const date = new Date(`${value.transactionDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.transactionDate) {
    context.addIssue({ code: "custom", path: ["transactionDate"], message: "Tarih geçerli değildir." });
  }
  const allowed = value.type === "INCOME" ? incomeCategories : expenseCategories;
  if (!(allowed as readonly string[]).includes(value.category)) {
    context.addIssue({ code: "custom", path: ["category"], message: "Seçilen kategori işlem türüyle uyumlu değildir." });
  }
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export const updateTransactionSchema = createTransactionSchema;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
