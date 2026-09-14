import { Prisma } from "@/generated/prisma/client";
import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { updateInsuranceCaseInputSchema } from "@/lib/insurance-arbitration/input";
import { getInsuranceCase, InsuranceCaseNotFoundError, InsuranceCaseVersionConflictError, updateInsuranceCase } from "@/lib/insurance-arbitration/service";
import { resourceIdSchema } from "@/lib/resource-id";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try { await requireApiSession(request); return json({ data: await getInsuranceCase(await readId(context)) }, 200); }
  catch (error) { return handle(error, "Dosya yüklenemedi."); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request);
    const validation = updateInsuranceCaseInputSchema.safeParse(await readJsonBody(request));
    if (!validation.success) return json({ error: { message: "Dosya bilgileri geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    return json({ data: await updateInsuranceCase(await readId(context), validation.data, session.user.id) }, 200);
  } catch (error) {
    if (error instanceof InsuranceCaseVersionConflictError) return json({ error: { code: "VERSION_CONFLICT", message: "Bu dosya siz açtıktan sonra başka biri tarafından düzenlendi. Güncel bilgileri yeniden yükleyin." } }, 409);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return json({ error: { message: "Bu tahkim başvuru numarası zaten kayıtlı." } }, 409);
    return handle(error, "Dosya güncellenemedi.");
  }
}

async function readId(context: Context) { const parsed = resourceIdSchema.safeParse((await context.params).id); if (!parsed.success) throw new ApiRequestError(404, "NOT_FOUND", "Dosya bulunamadı."); return parsed.data; }
function handle(error: unknown, message: string) { if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status); if (error instanceof InsuranceCaseNotFoundError) return json({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404); console.error(message, { error: error instanceof Error ? error.name : "UnknownError" }); return json({ error: { code: "INTERNAL_ERROR", message } }, 500); }
function json(body: unknown, status: number) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
