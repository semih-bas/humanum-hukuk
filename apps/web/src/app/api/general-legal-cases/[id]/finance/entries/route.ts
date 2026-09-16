import { NextResponse } from "next/server";

import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { createGeneralCaseFinancialEntrySchema } from "@/lib/general-legal-cases/finance-input";
import { createGeneralCaseFinancialEntry } from "@/lib/general-legal-cases/finance-service";
import { GeneralLegalCaseNotFoundError } from "@/lib/general-legal-cases/read";
import { resourceIdSchema } from "@/lib/resource-id";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const validation = createGeneralCaseFinancialEntrySchema.safeParse(await readJsonBody(request));
    if (!validation.success) {
      return json({ error: { code: "VALIDATION_ERROR", message: "Mali hareket bilgileri geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    }
    const caseId = await readId(context);
    return json({ data: await createGeneralCaseFinancialEntry(caseId, validation.data, { id: session.user.id, role: session.user.role }) }, 201);
  } catch (error) {
    if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof GeneralLegalCaseNotFoundError) return json({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404);
    console.error("Mali hareket oluşturulamadı.", { error: error instanceof Error ? error.name : "UnknownError" });
    return json({ error: { code: "INTERNAL_ERROR", message: "Mali hareket oluşturulamadı." } }, 500);
  }
}

async function readId(context: Context) {
  const parsed = resourceIdSchema.safeParse((await context.params).id);
  if (!parsed.success) throw new ApiRequestError(404, "NOT_FOUND", "Dosya bulunamadı.");
  return parsed.data;
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
