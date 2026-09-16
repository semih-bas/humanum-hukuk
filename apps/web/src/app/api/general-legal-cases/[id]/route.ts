import { NextResponse } from "next/server";

import { ApiRequestError, requireApiSession } from "@/lib/api-security";
import { GeneralLegalCaseNotFoundError, getGeneralLegalCase } from "@/lib/general-legal-cases/read";
import { resourceIdSchema } from "@/lib/resource-id";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const session = await requireApiSession(request);
    const id = await readId(context);
    return json({
      data: await getGeneralLegalCase(id, { id: session.user.id, role: session.user.role }),
    }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ error: { code: error.code, message: error.message } }, error.status);
    }
    if (error instanceof GeneralLegalCaseNotFoundError) {
      return json({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404);
    }
    console.error("Genel dava ve arabuluculuk dosyası yüklenemedi.", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return json({ error: { code: "INTERNAL_ERROR", message: "Dosya yüklenemedi." } }, 500);
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
