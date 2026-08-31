import { Prisma } from "@/generated/prisma/client";
import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { updateCaseSchema } from "@/lib/cases/create-case-input";
import { getCaseFile } from "@/lib/cases/get-case";
import { CaseHasNoChangesError, CaseNotFoundError, CaseVersionConflictError, updateCaseFile } from "@/lib/cases/update-case";
import { resourceIdSchema } from "@/lib/resource-id";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireApiSession(request);
    const id = await readId(context);
    const record = await getCaseFile(id);

    if (!record) return jsonResponse({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404);
    return jsonResponse({ data: record }, 200);
  } catch (error) {
    return handleError(error, "Dosya görüntülenirken beklenmeyen bir hata oluştu.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const id = await readId(context);
    const validation = updateCaseSchema.safeParse(await readJsonBody(request));

    if (!validation.success) {
      return jsonResponse({ error: { code: "VALIDATION_ERROR", message: "Gönderilen dosya bilgileri geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    }

    return jsonResponse({ data: await updateCaseFile(id, validation.data, session.user.id) }, 200);
  } catch (error) {
    if (error instanceof CaseVersionConflictError) return jsonResponse({ error: { code: "VERSION_CONFLICT", message: "Bu dosya siz açtıktan sonra başka biri tarafından düzenlendi. Güncel bilgileri yeniden yükleyin." } }, 409);
    if (error instanceof CaseHasNoChangesError) return jsonResponse({ error: { code: "NO_CHANGES", message: "Kaydedilecek bir değişiklik bulunamadı." } }, 400);
    if (error instanceof CaseNotFoundError) return jsonResponse({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonResponse({ error: { code: "CASE_CONFLICT", message: "Aynı icra dairesi ve dosya numarasıyla kayıtlı bir dosya zaten bulunuyor." } }, 409);
    return handleError(error, "Dosya güncellenirken beklenmeyen bir hata oluştu.");
  }
}

async function readId(context: RouteContext): Promise<string> {
  const result = resourceIdSchema.safeParse((await context.params).id);
  if (!result.success) throw new ApiRequestError(404, "NOT_FOUND", "Dosya bulunamadı.");
  return result.data;
}

function handleError(error: unknown, message: string) {
  if (error instanceof ApiRequestError) return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
  console.error("Case detail request failed", { error: error instanceof Error ? error.name : "UnknownError" });
  return jsonResponse({ error: { code: "INTERNAL_ERROR", message } }, 500);
}

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
