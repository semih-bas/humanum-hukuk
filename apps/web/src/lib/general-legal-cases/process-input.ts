import { hasControlCharacter, normalizeText } from "@/lib/form-input";
import { resourceIdSchema } from "@/lib/resource-id";
import { z } from "zod";

import { parseDateOnly } from "./input";

const stages = ["CASE_OPENING", "NOTIFICATION", "RESPONSE_PETITION", "PRELIMINARY_REVIEW", "EXAMINATION", "EXPERT_REPORT", "HEARING", "DECISION", "APPEAL", "CASSATION", "FINALIZATION", "COLLECTION", "CLOSED"] as const;
const version = z.number().int().min(1).max(2_147_483_647);

const requiredText = (label: string, maximum: number) => z.string().trim().min(1, `${label} zorunludur.`)
  .max(maximum, `${label} en fazla ${maximum} karakter olabilir.`)
  .refine((value) => !hasControlCharacter(value), `${label} geçersiz karakter içeriyor.`)
  .transform(normalizeText);

const optionalText = (label: string, maximum: number) => z.union([
  z.string().trim().max(maximum, `${label} en fazla ${maximum} karakter olabilir.`)
    .refine((value) => !hasControlCharacter(value), `${label} geçersiz karakter içeriyor.`),
  z.null(),
]).transform((value) => value ? normalizeText(value) : null);

const optionalUserId = z.union([resourceIdSchema, z.literal(""), z.null()]).transform((value) => value || null);
const eventDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "İşlem tarihi YYYY-MM-DD biçiminde olmalıdır.")
  .refine((value) => parseDateOnly(value) !== null, "İşlem tarihi geçerli değildir.")
  .refine((value) => value <= currentIstanbulDate(), "İşlem tarihi gelecekte olamaz.");

const processEntryFields = {
  type: z.enum(["STAGE_CHANGE", "FILING", "NOTIFICATION", "HEARING", "DECISION", "OTHER"]),
  stage: z.enum(stages),
  eventDate,
  action: requiredText("İşlem", 150),
  description: optionalText("Açıklama", 4_000),
  responsibleUserId: optionalUserId,
};

export const createGeneralCaseProcessEntrySchema = z.object(processEntryFields).strict();
export const updateGeneralCaseProcessEntrySchema = z.object({ ...processEntryFields, version }).strict();

const hearingFields = {
  startsAt: z.iso.datetime({ offset: true, error: "Duruşma tarihi ve saati geçerli olmalıdır." }).transform((value) => new Date(value)),
  court: requiredText("Mahkeme", 150),
  hearingType: requiredText("Duruşma türü", 100),
  courtroom: optionalText("Duruşma salonu", 100),
  attendeeUserId: optionalUserId,
  reminderOffsetMinutes: z.number().int().min(0).max(525_600).nullable(),
  note: optionalText("Duruşma notu", 4_000),
  status: z.enum(["PLANNED", "COMPLETED", "POSTPONED", "CANCELLED"]),
};
const rawHearingSchema = z.object(hearingFields).strict();

function validateHearing(value: z.infer<typeof rawHearingSchema>, context: z.RefinementCtx) {
  if (value.status === "PLANNED" && value.startsAt.getTime() <= Date.now()) {
    context.addIssue({ code: "custom", path: ["startsAt"], message: "Planlanan duruşma gelecekte olmalıdır." });
  }
}

export const createGeneralCaseHearingSchema = rawHearingSchema.superRefine(validateHearing);
export const updateGeneralCaseHearingSchema = z.object({ ...hearingFields, version }).strict().superRefine(validateHearing);

export type CreateGeneralCaseProcessEntryInput = z.infer<typeof createGeneralCaseProcessEntrySchema>;
export type UpdateGeneralCaseProcessEntryInput = z.infer<typeof updateGeneralCaseProcessEntrySchema>;
export type CreateGeneralCaseHearingInput = z.infer<typeof createGeneralCaseHearingSchema>;
export type UpdateGeneralCaseHearingInput = z.infer<typeof updateGeneralCaseHearingSchema>;

function currentIstanbulDate() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
