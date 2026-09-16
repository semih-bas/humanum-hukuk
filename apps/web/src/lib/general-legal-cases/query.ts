import { z } from "zod";

const dateFilter = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.literal(""),
]).default("").transform((value) => value || null);

export const generalLegalCaseListQuerySchema = z.object({
  query: z.string().trim().max(200).default(""),
  kind: z.enum(["ALL", "GENERAL_LITIGATION", "MEDIATION"]).default("ALL"),
  status: z.enum(["ALL", "DRAFT", "ACTIVE", "DECISION", "APPEAL", "COMPLETED", "CLOSED"]).default("ALL"),
  stage: z.enum([
    "ALL", "CASE_OPENING", "NOTIFICATION", "RESPONSE_PETITION", "PRELIMINARY_REVIEW", "EXAMINATION",
    "EXPERT_REPORT", "HEARING", "DECISION", "APPEAL", "CASSATION", "FINALIZATION", "COLLECTION", "CLOSED",
  ]).default("ALL"),
  dateFrom: dateFilter,
  dateTo: dateFilter,
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().refine((value) => [10, 20, 50].includes(value)).default(10),
}).strict().superRefine((value, context) => {
  if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
    context.addIssue({ code: "custom", path: ["dateTo"], message: "Bitiş tarihi başlangıç tarihinden önce olamaz." });
  }
});

export type GeneralLegalCaseListQuery = z.infer<typeof generalLegalCaseListQuerySchema>;
