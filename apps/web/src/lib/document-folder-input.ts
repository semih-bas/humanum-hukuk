import { z } from "zod";

export const fixedDocumentFolders = ["PAYMENT", "NOTIFICATION", "OTHER"] as const;
export const documentFolderKeySchema = z.string().max(100).refine((value) => fixedDocumentFolders.includes(value as typeof fixedDocumentFolders[number]) || /^CUSTOM:[0-9a-f-]{36}$/.test(value), "Evrak klasörü geçerli değildir.");
export const customDocumentFoldersSchema = z.array(z.object({ key: z.string().regex(/^CUSTOM:[0-9a-f-]{36}$/), label: z.string().trim().min(1).max(60) }).strict()).max(30).superRefine((folders, context) => {
  const keys = new Set<string>(); const labels = new Set<string>();
  folders.forEach((folder, index) => { const label = folder.label.toLocaleLowerCase("tr-TR"); if (keys.has(folder.key) || labels.has(label)) context.addIssue({ code: "custom", path: [index], message: "Klasör adları benzersiz olmalıdır." }); keys.add(folder.key); labels.add(label); });
});
export const updateDocumentFoldersSchema = z.object({ folders: customDocumentFoldersSchema }).strict();
export type DocumentFolder = z.infer<typeof customDocumentFoldersSchema>[number];

export function parseDocumentFolders(value: unknown): DocumentFolder[] {
  const parsed = customDocumentFoldersSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}
