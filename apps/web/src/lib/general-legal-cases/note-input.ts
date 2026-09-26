import { hasControlCharacter, normalizeText } from "@/lib/form-input";
import { z } from "zod";

export const createGeneralCaseNoteSchema = z.object({
  content: z.string().trim().min(1, "Not içeriği zorunludur.").max(20_000, "Not en fazla 20000 karakter olabilir.")
    .refine((value) => !hasControlCharacter(value), "Not geçersiz karakter içeriyor.").transform(normalizeText),
  noteType: z.enum(["GENERAL", "ASSESSMENT", "MEETING", "REMINDER", "STRATEGY", "INFORMATION", "OTHER"]),
  visibility: z.enum(["TEAM", "PRIVATE"]),
  important: z.boolean(),
}).strict();
export type CreateGeneralCaseNoteInput = z.infer<typeof createGeneralCaseNoteSchema>;
