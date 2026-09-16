import { Prisma } from "@/generated/prisma/client";
import { hasControlCharacter, normalizeText, parseMoneyToCents } from "@/lib/form-input";
import { resourceIdSchema } from "@/lib/resource-id";
import { z } from "zod";

const MAX_MONEY = new Prisma.Decimal("9999999999999999.99");
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const requiredText = (label: string, maximum: number) => z.string({ error: `${label} metin olmalıdır.` })
  .trim()
  .min(1, `${label} zorunludur.`)
  .max(maximum, `${label} en fazla ${maximum} karakter olabilir.`)
  .refine((value) => !hasControlCharacter(value), `${label} geçersiz kontrol karakterleri içeremez.`)
  .transform(normalizeText);

const optionalText = (label: string, maximum: number) => z.union([
  z.string({ error: `${label} metin olmalıdır.` })
    .trim()
    .max(maximum, `${label} en fazla ${maximum} karakter olabilir.`)
    .refine((value) => !hasControlCharacter(value), `${label} geçersiz kontrol karakterleri içeremez.`),
  z.null(),
]).transform((value) => value ? normalizeText(value) : null);

const date = (label: string) => z.string().regex(DATE_PATTERN, `${label} YYYY-MM-DD biçiminde olmalıdır.`)
  .refine((value) => parseDateOnly(value) !== null, `${label} geçerli bir takvim tarihi olmalıdır.`);

const optionalDate = (label: string) => z.union([date(label), z.literal(""), z.null()])
  .transform((value) => value || null);

const money = z.union([z.string(), z.number()]).transform((value, context) => {
  const cents = parseMoneyToCents(String(value));
  if (cents === null) {
    context.addIssue({ code: "custom", message: "Tutar geçerli, sıfır veya pozitif bir para değeri olmalıdır." });
    return z.NEVER;
  }
  const result = new Prisma.Decimal(`${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`);
  if (result.gt(MAX_MONEY)) {
    context.addIssue({ code: "custom", message: "Tutar izin verilen üst sınırı aşıyor." });
    return z.NEVER;
  }
  return result;
});

const optionalEmail = z.union([
  z.email("E-posta adresi geçerli değildir.").max(254),
  z.literal(""),
  z.null(),
]).transform((value) => value || null);

const optionalIdentity = z.union([
  z.string().trim().regex(/^\d{10,11}$/, "T.C./Vergi numarası 10 veya 11 rakam olmalıdır."),
  z.literal(""),
  z.null(),
]).transform((value) => value || null);

export const generalCasePartyInputSchema = z.object({
  role: z.enum(["PLAINTIFF", "DEFENDANT", "APPLICANT", "RESPONDENT", "INTERVENOR", "THIRD_PARTY", "RELATED_INSTITUTION"]),
  kind: z.enum(["INDIVIDUAL", "ORGANIZATION"]),
  name: requiredText("Taraf adı", 200),
  identityOrTaxNumber: optionalIdentity,
  phone: optionalText("Telefon", 30),
  email: optionalEmail,
  address: optionalText("Adres", 2_000),
  representativeUserId: z.union([resourceIdSchema, z.literal(""), z.null()]).transform((value) => value || null),
  representativeName: optionalText("Vekil adı", 200),
  clientType: optionalText("Müvekkil türü", 100),
  description: optionalText("Taraf açıklaması", 500),
}).strict();

const rawGeneralLegalCaseInputSchema = z.object({
  kind: z.enum(["GENERAL_LITIGATION", "MEDIATION"]),
  caseType: requiredText("Dosya türü", 100),
  subject: requiredText("Dosya konusu", 4_000),
  openingDate: date("Açılış tarihi"),
  caseValue: money,
  uyapMainNumber: optionalText("UYAP esas numarası", 80),
  uyapDecisionNumber: optionalText("UYAP karar numarası", 80),
  courthouse: optionalText("Adliye", 150),
  courtType: optionalText("Mahkeme türü", 100),
  court: optionalText("Mahkeme", 150),
  status: z.enum(["DRAFT", "ACTIVE", "DECISION", "APPEAL", "COMPLETED", "CLOSED"]),
  stage: z.enum(["CASE_OPENING", "NOTIFICATION", "RESPONSE_PETITION", "PRELIMINARY_REVIEW", "EXAMINATION", "EXPERT_REPORT", "HEARING", "DECISION", "APPEAL", "CASSATION", "FINALIZATION", "COLLECTION", "CLOSED"]),
  procedure: optionalText("Dava usulü", 100),
  urgent: z.boolean(),
  confidentiality: z.enum(["NORMAL", "RESTRICTED"]),
  estimatedCompletionDate: optionalDate("Tahmini sonuç tarihi"),
  trackingGroup: optionalText("Takip grubu", 100),
  tags: z.array(requiredText("Etiket", 40)).max(20, "En fazla 20 etiket eklenebilir.")
    .transform((values) => [...new Set(values.map((value) => value.toLocaleLowerCase("tr-TR")))]),
  office: optionalText("Ofis", 100),
  description: optionalText("Açıklama", 4_000),
  responsibleUserId: resourceIdSchema,
  fileStaffUserId: z.union([resourceIdSchema, z.literal(""), z.null()]).transform((value) => value || null),
  parties: z.array(generalCasePartyInputSchema).min(2, "En az iki taraf eklenmelidir.").max(100, "Bir dosyada en fazla 100 taraf olabilir."),
}).strict();

function validateGeneralLegalCase(value: z.infer<typeof rawGeneralLegalCaseInputSchema>, context: z.RefinementCtx) {
  if (value.openingDate > currentIstanbulDate()) {
    context.addIssue({ code: "custom", path: ["openingDate"], message: "Açılış tarihi gelecekte olamaz." });
  }
  if (value.estimatedCompletionDate && value.estimatedCompletionDate < value.openingDate) {
    context.addIssue({ code: "custom", path: ["estimatedCompletionDate"], message: "Tahmini sonuç tarihi açılış tarihinden önce olamaz." });
  }
  if ((value.status === "CLOSED") !== (value.stage === "CLOSED")) {
    context.addIssue({ code: "custom", path: ["status"], message: "Kapalı dosyanın durumu ve aşaması birlikte kapatılmalıdır." });
  }

  const roles = new Set(value.parties.map((party) => party.role));
  const requiredRoles = value.kind === "GENERAL_LITIGATION"
    ? (["PLAINTIFF", "DEFENDANT"] as const)
    : (["APPLICANT", "RESPONDENT"] as const);
  for (const role of requiredRoles) {
    if (!roles.has(role)) {
      context.addIssue({ code: "custom", path: ["parties"], message: "Dosyanın iki ana tarafı da eklenmelidir." });
      break;
    }
  }

  if (value.kind === "GENERAL_LITIGATION" && (!value.courthouse || !value.courtType || !value.court)) {
    context.addIssue({ code: "custom", path: ["court"], message: "Genel dava için adliye, mahkeme türü ve mahkeme zorunludur." });
  }
}

export const createGeneralLegalCaseInputSchema = rawGeneralLegalCaseInputSchema.superRefine(validateGeneralLegalCase);

export const updateGeneralLegalCaseInputSchema = rawGeneralLegalCaseInputSchema.extend({
  version: z.number({ error: "Dosya sürümü sayı olmalıdır." }).int().min(1).max(2_147_483_647),
}).strict().superRefine(validateGeneralLegalCase);

export type GeneralCasePartyInput = z.infer<typeof generalCasePartyInputSchema>;
export type CreateGeneralLegalCaseInput = z.infer<typeof createGeneralLegalCaseInputSchema>;
export type UpdateGeneralLegalCaseInput = z.infer<typeof updateGeneralLegalCaseInputSchema>;

export function parseDateOnly(value: string | null): Date | null {
  if (!value || !DATE_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

function currentIstanbulDate(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
