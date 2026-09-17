import { NextResponse } from "next/server";

import { ApiRequestError, requireApiSession } from "@/lib/api-security";
import { getGeneralCaseOverview } from "@/lib/general-legal-cases/overview";
import { GeneralLegalCaseNotFoundError } from "@/lib/general-legal-cases/read";
import { resourceIdSchema } from "@/lib/resource-id";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const session = await requireApiSession(request);
    const id = resourceIdSchema.safeParse((await params).id);
    if (!id.success) throw new ApiRequestError(404, "NOT_FOUND", "Dosya bulunamadı.");
    return json({ data: await getGeneralCaseOverview(id.data, { id: session.user.id, role: session.user.role }) }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof GeneralLegalCaseNotFoundError) return json({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404);
    console.error("Dosya özeti yüklenemedi", { error: error instanceof Error ? error.name : "UnknownError" });
    return json({ error: { code: "INTERNAL_ERROR", message: "Dosya özeti yüklenemedi." } }, 500);
  }
}

function json(body: unknown, status: number) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
