import { NextResponse } from "next/server";

import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { generalCaseFinanceSummarySchema } from "@/lib/general-legal-cases/finance-input";
import { GeneralCaseFinanceVersionConflictError, getGeneralCaseFinance, updateGeneralCaseFinance } from "@/lib/general-legal-cases/finance-service";
import { GeneralLegalCaseNotFoundError } from "@/lib/general-legal-cases/read";
import { resourceIdSchema } from "@/lib/resource-id";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const session = await requireApiSession(request);
    return json({ data: await getGeneralCaseFinance(await readId(context), actor(session)) }, 200);
  } catch (error) {
    return handle(error, "Mali bilgiler yüklenemedi.");
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const validation = generalCaseFinanceSummarySchema.safeParse(await readJsonBody(request));
    if (!validation.success) {
      return json({ error: { code: "VALIDATION_ERROR", message: "Mali bilgiler geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    }
    return json({ data: await updateGeneralCaseFinance(await readId(context), validation.data, actor(session)) }, 200);
  } catch (error) {
    return handle(error, "Mali bilgiler güncellenemedi.");
  }
}

function actor(session: Awaited<ReturnType<typeof requireApiSession>>) {
  return { id: session.user.id, role: session.user.role };
}

async function readId(context: Context) {
  const parsed = resourceIdSchema.safeParse((await context.params).id);
  if (!parsed.success) throw new ApiRequestError(404, "NOT_FOUND", "Dosya bulunamadı.");
  return parsed.data;
}

function handle(error: unknown, message: string) {
  if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof GeneralLegalCaseNotFoundError) return json({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404);
  if (error instanceof GeneralCaseFinanceVersionConflictError) return json({ error: { code: "VERSION_CONFLICT", message: "Mali bilgiler başka bir kullanıcı tarafından güncellendi. Güncel verileri yeniden yükleyin." } }, 409);
  console.error(message, { error: error instanceof Error ? error.name : "UnknownError" });
  return json({ error: { code: "INTERNAL_ERROR", message } }, 500);
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
