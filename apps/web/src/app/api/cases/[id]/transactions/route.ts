import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { createCaseTransaction, listCaseTransactions } from "@/lib/cases/case-transactions";
import { createTransactionSchema } from "@/lib/cases/transaction-input";
import { CaseNotFoundError } from "@/lib/cases/update-case";
import { resourceIdSchema } from "@/lib/resource-id";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requireApiSession(request);
    return json({ data: await listCaseTransactions(await readId(context)) }, 200);
  } catch (error) { return handle(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const validation = createTransactionSchema.safeParse(await readJsonBody(request));
    if (!validation.success) return json({ error: { code: "VALIDATION_ERROR", message: "Gelir/gider bilgileri geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    return json({ data: await createCaseTransaction(await readId(context), validation.data, session.user.id) }, 201);
  } catch (error) { return handle(error); }
}

async function readId(context: Context) {
  const result = resourceIdSchema.safeParse((await context.params).id);
  if (!result.success) throw new ApiRequestError(404, "NOT_FOUND", "Dosya bulunamadı.");
  return result.data;
}

function handle(error: unknown) {
  if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof CaseNotFoundError) return json({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404);
  console.error("Case transaction request failed", { error: error instanceof Error ? error.name : "UnknownError" });
  return json({ error: { code: "INTERNAL_ERROR", message: "Gelir/gider işlemi sırasında beklenmeyen bir hata oluştu." } }, 500);
}

function json(body: unknown, status: number) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
