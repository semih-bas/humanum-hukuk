import { NextResponse } from "next/server";

import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { createGeneralLegalCase, GeneralLegalCaseUserReferenceError } from "@/lib/general-legal-cases/create";
import { createGeneralLegalCaseInputSchema } from "@/lib/general-legal-cases/input";
import { generalLegalCaseListQuerySchema } from "@/lib/general-legal-cases/query";
import { listGeneralLegalCases } from "@/lib/general-legal-cases/service";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request);
    const validation = generalLegalCaseListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!validation.success) return json({ error: { message: "Filtre bilgileri geçerli değil." } }, 400);
    return json({ data: await listGeneralLegalCases(validation.data, { id: session.user.id, role: session.user.role }) }, 200);
  } catch (error) {
    return handle(error, "Genel dava ve arabuluculuk dosyaları yüklenemedi.");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const validation = createGeneralLegalCaseInputSchema.safeParse(await readJsonBody(request));
    if (!validation.success) {
      return json({
        error: { message: "Dosya bilgileri geçerli değil.", fields: validation.error.flatten().fieldErrors },
      }, 400);
    }
    return json({ data: await createGeneralLegalCase(validation.data, session.user.id) }, 201);
  } catch (error) {
    return handle(error, "Genel dava ve arabuluculuk dosyası oluşturulamadı.");
  }
}

function handle(error: unknown, message: string) {
  if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof GeneralLegalCaseUserReferenceError) {
    return json({ error: { code: "INVALID_USER_REFERENCE", message: "Seçilen sorumlu veya vekil aktif değil." } }, 400);
  }
  console.error(message, { error: error instanceof Error ? error.name : "UnknownError" });
  return json({ error: { code: "INTERNAL_ERROR", message } }, 500);
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
