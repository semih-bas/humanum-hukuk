import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { addCaseReminder } from "@/lib/cases/add-case-activity";
import { addCaseReminderSchema } from "@/lib/cases/create-case-input";
import { CaseNotFoundError } from "@/lib/cases/update-case";
import { NextResponse } from "next/server";
import { z } from "zod";

const idSchema = z.string().min(20).max(40).regex(/^[a-z0-9]+$/i);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const idResult = idSchema.safeParse((await params).id);
    if (!idResult.success) throw new ApiRequestError(404, "NOT_FOUND", "Dosya bulunamadı.");
    const validation = addCaseReminderSchema.safeParse(await readJsonBody(request));
    if (!validation.success) return jsonResponse({ error: { code: "VALIDATION_ERROR", message: "Hatırlatma bilgileri geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    return jsonResponse({ data: await addCaseReminder(idResult.data, validation.data, session.user.id) }, 201);
  } catch (error) {
    if (error instanceof ApiRequestError) return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof CaseNotFoundError) return jsonResponse({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404);
    console.error("Failed to add case reminder", { error: error instanceof Error ? error.name : "UnknownError" });
    return jsonResponse({ error: { code: "INTERNAL_ERROR", message: "Hatırlatma eklenirken beklenmeyen bir hata oluştu." } }, 500);
  }
}

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
