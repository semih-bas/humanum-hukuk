import { ApiRequestError, requireApiSession } from "@/lib/api-security";
import { tryWriteAuditLog } from "@/lib/audit";
import { DocumentNotFoundError, readCaseDocument } from "@/lib/document-storage";
import { resourceIdSchema } from "@/lib/resource-id";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const session = await requireApiSession(request);
    const values = await params;
    const caseId = resourceIdSchema.safeParse(values.id);
    const documentId = resourceIdSchema.safeParse(values.documentId);
    if (!caseId.success || !documentId.success) throw new DocumentNotFoundError();

    const document = await readCaseDocument(caseId.data, documentId.data);
    await tryWriteAuditLog({
      actorUserId: session.user.id,
      event: "case.document_downloaded",
      targetType: "case_document",
      targetId: documentId.data,
      context: { caseFileId: caseId.data },
    });
    const encodedName = encodeURIComponent(document.originalName).replaceAll("'", "%27");
    return new Response(new Uint8Array(document.data), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="evrak"; filename*=UTF-8''${encodedName}`,
        "Content-Length": String(document.sizeBytes),
        "Content-Security-Policy": "sandbox",
        "Content-Type": document.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ApiRequestError) return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof DocumentNotFoundError) return jsonResponse({ error: { code: "NOT_FOUND", message: "Evrak bulunamadı." } }, 404);
    console.error("Failed to download case document", { error: error instanceof Error ? error.name : "UnknownError" });
    return jsonResponse({ error: { code: "INTERNAL_ERROR", message: "Evrak indirilirken beklenmeyen bir hata oluştu." } }, 500);
  }
}

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
