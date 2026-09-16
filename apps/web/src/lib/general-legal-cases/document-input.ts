import { hasControlCharacter, normalizeText } from "@/lib/form-input";
import { z } from "zod";

export const generalCaseDocumentCategories = [
  "DAVA_DILEKCESI", "CEVAP_DILEKCESI", "REPLIK_DUPLIK", "DELIL", "BILIRKISI_RAPORU",
  "DURUSMA_TUTANAGI", "ARA_KARAR", "TEBLIGAT", "ISTINAF", "YARGITAY", "KARAR",
  "KESINLESME_SERHI", "GELEN_EVRAK", "GIDEN_EVRAK", "DIGER",
] as const;

export const generalCaseDocumentCategorySchema = z.enum(generalCaseDocumentCategories, {
  error: "Evrak kategorisi geçerli değildir.",
});

export const generalCaseDocumentNameSchema = z.string()
  .trim()
  .min(1, "Evrak adı zorunludur.")
  .max(255, "Evrak adı en fazla 255 karakter olabilir.")
  .refine((value) => !hasControlCharacter(value), "Evrak adı geçersiz karakter içeriyor.")
  .transform(normalizeText);

export type GeneralCaseDocumentCategory = z.infer<typeof generalCaseDocumentCategorySchema>;
