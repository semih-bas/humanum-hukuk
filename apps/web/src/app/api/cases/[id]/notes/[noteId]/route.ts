import { NextResponse } from "next/server";

import { ApiRequestError, assertSameOrigin, requireApiSession } from "@/lib/api-security";
import { deleteCaseNote } from "@/lib/cases/add-case-activity";
import { CaseNotFoundError } from "@/lib/cases/update-case";
import { resourceIdSchema } from "@/lib/resource-id";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const values = await params;
    const id = resourceIdSchema.safeParse(values.id);
    const noteId = resourceIdSchema.safeParse(values.noteId);
    if (!id.success || !noteId.success) throw new ApiRequestError(404, "NOT_FOUND", "Not bulunamadı.");
    await deleteCaseNote(id.data, noteId.data, session.user.id);
    return NextResponse.json({ data: { deleted: true } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiRequestError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    if (error instanceof CaseNotFoundError) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not bulunamadı." } }, { status: 404 });
    console.error("Failed to delete case note", { error: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Not kaldırılırken beklenmeyen bir hata oluştu." } }, { status: 500 });
  }
}
