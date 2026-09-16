import { ApiRequestError, requireApiSession } from "@/lib/api-security";
import { GeneralCaseDocumentNotFoundError, readGeneralCaseDocument } from "@/lib/general-legal-cases/document-storage";
import { resourceIdSchema } from "@/lib/resource-id";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const session = await requireApiSession(request); const values = await params;
    const id = resourceIdSchema.safeParse(values.id); const documentId = resourceIdSchema.safeParse(values.documentId);
    if (!id.success || !documentId.success) throw new GeneralCaseDocumentNotFoundError();
    const document = await readGeneralCaseDocument(id.data, documentId.data, { id: session.user.id, role: session.user.role });
    const name = encodeURIComponent(document.originalName).replaceAll("'", "%27");
    return new Response(new Uint8Array(document.data), { headers: { "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="evrak"; filename*=UTF-8''${name}`, "Content-Length": String(document.sizeBytes), "Content-Type": document.mimeType, "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof ApiRequestError) return NextResponse.json({ error: { message: error.message } }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: { message: "Evrak bulunamadı." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
