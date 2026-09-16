import { NextResponse } from "next/server";

import { ApiRequestError } from "@/lib/api-security";
import { resourceIdSchema } from "@/lib/resource-id";

import { GeneralCaseProcessRecordNotFoundError, GeneralCaseProcessVersionConflictError } from "./process-service";
import { GeneralLegalCaseNotFoundError } from "./read";
import { GeneralLegalCaseUserReferenceError } from "./user-references";

export function processJson(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function handleProcessApiError(error: unknown, message: string) {
  if (error instanceof ApiRequestError) return processJson({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof GeneralLegalCaseNotFoundError) return processJson({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404);
  if (error instanceof GeneralCaseProcessRecordNotFoundError) return processJson({ error: { code: "NOT_FOUND", message: "Süreç kaydı bulunamadı." } }, 404);
  if (error instanceof GeneralCaseProcessVersionConflictError) return processJson({ error: { code: "VERSION_CONFLICT", message: "Kayıt başka bir kullanıcı tarafından güncellendi. Güncel verileri yeniden yükleyin." } }, 409);
  if (error instanceof GeneralLegalCaseUserReferenceError) return processJson({ error: { code: "INVALID_USER_REFERENCE", message: "Seçilen kullanıcı aktif değil." } }, 400);
  console.error(message, { error: error instanceof Error ? error.name : "UnknownError" });
  return processJson({ error: { code: "INTERNAL_ERROR", message } }, 500);
}

export function parseProcessId(value: string, message = "Kayıt bulunamadı.") {
  const parsed = resourceIdSchema.safeParse(value);
  if (!parsed.success) throw new ApiRequestError(404, "NOT_FOUND", message);
  return parsed.data;
}
