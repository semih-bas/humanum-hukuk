import { NextResponse } from "next/server";

import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { updateGeneralLegalCaseInputSchema } from "@/lib/general-legal-cases/input";
import { GeneralLegalCaseNotFoundError, getGeneralLegalCase } from "@/lib/general-legal-cases/read";
import { GeneralLegalCaseRestrictedAccessError, GeneralLegalCaseVersionConflictError, updateGeneralLegalCase } from "@/lib/general-legal-cases/update";
import { GeneralLegalCaseUserReferenceError } from "@/lib/general-legal-cases/user-references";
import { resourceIdSchema } from "@/lib/resource-id";
import { archiveGeneralCase, deletionResponse, RecoverableRecordNotFoundError } from "@/lib/recoverable-deletion";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const session = await requireApiSession(request);
    const id = await readId(context);
    return json({
      data: await getGeneralLegalCase(id, { id: session.user.id, role: session.user.role }),
    }, 200);
  } catch (error) {
    return handle(error, "Dosya yüklenemedi.");
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const validation = updateGeneralLegalCaseInputSchema.safeParse(await readJsonBody(request));
    if (!validation.success) {
      return json({ error: { message: "Dosya bilgileri geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    }
    const id = await readId(context);
    return json({ data: await updateGeneralLegalCase(id, validation.data, { id: session.user.id, role: session.user.role }) }, 200);
  } catch (error) {
    if (error instanceof GeneralLegalCaseVersionConflictError) {
      return json({ error: { code: "VERSION_CONFLICT", message: "Bu dosya siz açtıktan sonra başka biri tarafından düzenlendi. Güncel bilgileri yeniden yükleyin." } }, 409);
    }
    if (error instanceof GeneralLegalCaseRestrictedAccessError) {
      return json({ error: { code: "RESTRICTED_ACCESS_REQUIRED", message: "Kısıtlı dosyada erişiminizi koruyan bir sorumluluk seçmelisiniz." } }, 403);
    }
    if (error instanceof GeneralLegalCaseUserReferenceError) {
      return json({ error: { code: "INVALID_USER_REFERENCE", message: "Seçilen sorumlu veya vekil aktif değil." } }, 400);
    }
    return handle(error, "Dosya güncellenemedi.");
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const result = await archiveGeneralCase(await readId(context), { id: session.user.id, role: session.user.role });
    return json({ data: deletionResponse(result) }, 200);
  } catch (error) {
    if (error instanceof RecoverableRecordNotFoundError) return json({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı, erişiminiz yok veya daha önce silindi." } }, 404);
    return handle(error, "Dosya silinemedi.");
  }
}

function handle(error: unknown, message: string) {
  if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof GeneralLegalCaseNotFoundError) return json({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404);
  console.error(message, { error: error instanceof Error ? error.name : "UnknownError" });
  return json({ error: { code: "INTERNAL_ERROR", message } }, 500);
}

async function readId(context: Context) {
  const parsed = resourceIdSchema.safeParse((await context.params).id);
  if (!parsed.success) throw new ApiRequestError(404, "NOT_FOUND", "Dosya bulunamadı.");
  return parsed.data;
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
