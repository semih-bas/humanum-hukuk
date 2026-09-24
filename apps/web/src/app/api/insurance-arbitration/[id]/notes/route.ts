import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { addInsuranceCaseNoteSchema } from "@/lib/insurance-arbitration/input";
import { addInsuranceCaseNote, InsuranceCaseNotFoundError } from "@/lib/insurance-arbitration/service";
import { resourceIdSchema } from "@/lib/resource-id";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const id = resourceIdSchema.safeParse((await params).id);
    if (!id.success) throw new ApiRequestError(404, "NOT_FOUND", "Dosya bulunamadı.");
    const input = addInsuranceCaseNoteSchema.safeParse(await readJsonBody(request));
    if (!input.success) return json({ error: { code: "VALIDATION_ERROR", message: "Not bilgisi geçerli değil.", fields: input.error.flatten().fieldErrors } }, 400);
    return json({ data: await addInsuranceCaseNote(id.data, input.data.content, session.user.id) }, 201);
  } catch (error) {
    if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof InsuranceCaseNotFoundError) return json({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404);
    console.error("Failed to add insurance arbitration note", { error: error instanceof Error ? error.name : "UnknownError" });
    return json({ error: { code: "INTERNAL_ERROR", message: "Not eklenirken beklenmeyen bir hata oluştu." } }, 500);
  }
}

function json(body: unknown, status: number) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
