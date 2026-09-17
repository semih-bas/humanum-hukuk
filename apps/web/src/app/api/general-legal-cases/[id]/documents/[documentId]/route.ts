import { ApiRequestError, requireApiSession } from "@/lib/api-security";
import { deleteGeneralCaseDocument, GeneralCaseDocumentNotFoundError, moveGeneralCaseDocument, readGeneralCaseDocument } from "@/lib/general-legal-cases/document-storage";
import { generalCaseDocumentFolderKeySchema } from "@/lib/general-legal-cases/document-input";
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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const session = await requireApiSession(request); const values = await params;
    const id = resourceIdSchema.safeParse(values.id); const documentId = resourceIdSchema.safeParse(values.documentId);
    if (!id.success || !documentId.success) throw new GeneralCaseDocumentNotFoundError();
    return NextResponse.json({ data: await deleteGeneralCaseDocument(id.data, documentId.data, { id: session.user.id, role: session.user.role }) }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiRequestError) return NextResponse.json({ error: { message: error.message } }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: { message: "Evrak silinemedi veya bulunamadı." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const session = await requireApiSession(request); const values = await params;
    const id = resourceIdSchema.safeParse(values.id); const documentId = resourceIdSchema.safeParse(values.documentId);
    const body = await request.json(); const folderKey = body?.folderKey === null ? { success: true as const, data: null } : generalCaseDocumentFolderKeySchema.safeParse(body?.folderKey);
    if (!id.success || !documentId.success || !folderKey.success) return NextResponse.json({ error: { message: "Evrak klasörü geçerli değildir." } }, { status: 400 });
    return NextResponse.json({ data: await moveGeneralCaseDocument(id.data, documentId.data, folderKey.data, { id: session.user.id, role: session.user.role }) }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiRequestError) return NextResponse.json({ error: { message: error.message } }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: { message: "Evrak taşınamadı veya bulunamadı." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
