import { hasControlCharacter, normalizeText } from "@/lib/form-input";
import { resourceIdSchema } from "@/lib/resource-id";
import { z } from "zod";

const requiredText = (label: string, maximum: number) => z.string().trim().min(1, `${label} zorunludur.`)
  .max(maximum, `${label} en fazla ${maximum} karakter olabilir.`)
  .refine((value) => !hasControlCharacter(value), `${label} geçersiz karakter içeriyor.`)
  .transform(normalizeText);
const optionalText = (label: string, maximum: number) => z.union([
  z.string().trim().max(maximum, `${label} en fazla ${maximum} karakter olabilir.`)
    .refine((value) => !hasControlCharacter(value), `${label} geçersiz karakter içeriyor.`),
  z.null(),
]).transform((value) => value ? normalizeText(value) : null);

export const createGeneralCaseTaskSchema = z.object({
  title: requiredText("Görev başlığı", 150),
  description: optionalText("Görev açıklaması", 4_000),
  assigneeUserId: z.union([resourceIdSchema, z.literal(""), z.null()]).transform((value) => value || null),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  dueAt: z.iso.datetime({ offset: true, error: "Görev son tarihi geçerli olmalıdır." }).transform((value) => new Date(value)),
  taskType: optionalText("Görev türü", 100),
  reminderOffsetMinutes: z.number().int().min(0).max(525_600).nullable(),
  status: z.enum(["PLANNED", "WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
}).strict();

export type CreateGeneralCaseTaskInput = z.infer<typeof createGeneralCaseTaskSchema>;
