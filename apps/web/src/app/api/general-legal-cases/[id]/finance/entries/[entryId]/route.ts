import { NextResponse } from "next/server";

import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { updateGeneralCaseFinancialEntrySchema } from "@/lib/general-legal-cases/finance-input";
import {
  deleteGeneralCaseFinancialEntry,
  GeneralCaseFinancialEntryNotFoundError,
  GeneralCaseFinanceVersionConflictError,
  updateGeneralCaseFinancialEntry,
} from "@/lib/general-legal-cases/finance-service";
import { GeneralLegalCaseNotFoundError } from "@/lib/general-legal-cases/read";
import { resourceIdSchema } from "@/lib/resource-id";

type Context = { params: Promise<{ id: string; entryId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const validation = updateGeneralCaseFinancialEntrySchema.safeParse(await readJsonBody(request));
    if (!validation.success) {
      return json({ error: { code: "VALIDATION_ERROR", message: "Mali hareket bilgileri geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    }
    const ids = await readIds(context);
    return json({ data: await updateGeneralCaseFinancialEntry(ids.caseId, ids.entryId, validation.data, { id: session.user.id, role: session.user.role }) }, 200);
  } catch (error) {
    return handle(error, "Mali hareket güncellenemedi.");
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const ids = await readIds(context);
    return json({ data: await deleteGeneralCaseFinancialEntry(ids.caseId, ids.entryId, { id: session.user.id, role: session.user.role }) }, 200);
  } catch (error) {
    return handle(error, "Mali hareket silinemedi.");
  }
}

async function readIds(context: Context) {
  const values = await context.params;
  const caseId = resourceIdSchema.safeParse(values.id);
  const entryId = resourceIdSchema.safeParse(values.entryId);
  if (!caseId.success || !entryId.success) throw new ApiRequestError(404, "NOT_FOUND", "Kayıt bulunamadı.");
  return { caseId: caseId.data, entryId: entryId.data };
}

function handle(error: unknown, message: string) {
  if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof GeneralLegalCaseNotFoundError) return json({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404);
  if (error instanceof GeneralCaseFinancialEntryNotFoundError) return json({ error: { code: "NOT_FOUND", message: "Mali hareket bulunamadı." } }, 404);
  if (error instanceof GeneralCaseFinanceVersionConflictError) return json({ error: { code: "VERSION_CONFLICT", message: "Mali hareket başka bir kullanıcı tarafından güncellendi. Güncel verileri yeniden yükleyin." } }, 409);
  console.error(message, { error: error instanceof Error ? error.name : "UnknownError" });
  return json({ error: { code: "INTERNAL_ERROR", message } }, 500);
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
