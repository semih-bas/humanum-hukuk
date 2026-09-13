import { ApiRequestError, assertSameOrigin, requireApiSession } from "@/lib/api-security";
import { CaseTransactionNotFoundError, deleteCaseTransaction } from "@/lib/cases/case-transactions";
import { resourceIdSchema } from "@/lib/resource-id";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string; transactionId: string }> };

export async function DELETE(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const values = await params;
    const caseId = resourceIdSchema.safeParse(values.id);
    const transactionId = resourceIdSchema.safeParse(values.transactionId);
    if (!caseId.success || !transactionId.success) throw new ApiRequestError(404, "NOT_FOUND", "Kayıt bulunamadı.");
    return json({ data: await deleteCaseTransaction(caseId.data, transactionId.data, session.user.id) }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof CaseTransactionNotFoundError) return json({ error: { code: "NOT_FOUND", message: "Kayıt bulunamadı." } }, 404);
    console.error("Case transaction deletion failed", { error: error instanceof Error ? error.name : "UnknownError" });
    return json({ error: { code: "INTERNAL_ERROR", message: "Kayıt silinirken beklenmeyen bir hata oluştu." } }, 500);
  }
}

function json(body: unknown, status: number) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
