import { ApiRequestError, requireApiSession } from "@/lib/api-security";
import { DocumentNotFoundError, readCaseDocument } from "@/lib/document-storage";
import { NextResponse } from "next/server";
import { z } from "zod";

const idSchema = z.string().min(20).max(40).regex(/^[a-z0-9]+$/i);

export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    await requireApiSession(request);
    const values = await params;
    const caseId = idSchema.safeParse(values.id);
    const documentId = idSchema.safeParse(values.documentId);
    if (!caseId.success || !documentId.success) throw new DocumentNotFoundError();

    const document = await readCaseDocument(caseId.data, documentId.data);
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
