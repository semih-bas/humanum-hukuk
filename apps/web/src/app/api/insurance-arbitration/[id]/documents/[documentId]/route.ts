import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { deleteInsuranceDocument, moveInsuranceDocument, readInsuranceDocument, InsuranceDocumentNotFoundError } from "@/lib/insurance-arbitration/document-storage";
import { documentFolderKeySchema } from "@/lib/document-folder-input";
import { resourceIdSchema } from "@/lib/resource-id";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    await requireApiSession(request); const values = await params;
    const id = resourceIdSchema.safeParse(values.id); const documentId = resourceIdSchema.safeParse(values.documentId);
    if (!id.success || !documentId.success) throw new InsuranceDocumentNotFoundError();
    const document = await readInsuranceDocument(id.data, documentId.data);
    const name = encodeURIComponent(document.originalName).replaceAll("'", "%27");
    return new Response(new Uint8Array(document.data), { headers: { "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="belge"; filename*=UTF-8''${name}`, "Content-Length": String(document.sizeBytes), "Content-Type": document.mimeType, "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof ApiRequestError) return NextResponse.json({ error: { message: error.message } }, { status: error.status });
    return NextResponse.json({ error: { message: "Belge bulunamadı." } }, { status: 404 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request); const values = await params; const id = resourceIdSchema.safeParse(values.id); const documentId = resourceIdSchema.safeParse(values.documentId); const body = await readJsonBody(request); const folderKey = documentFolderKeySchema.safeParse((body as { folderKey?: unknown } | null)?.folderKey);
    if (!id.success || !documentId.success || !folderKey.success) throw new InsuranceDocumentNotFoundError();
    return NextResponse.json({ data: await moveInsuranceDocument(id.data, documentId.data, folderKey.data, session.user.id) }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiRequestError) return NextResponse.json({ error: { message: error.message } }, { status: error.status });
    return NextResponse.json({ error: { message: "Belge taşınamadı veya bulunamadı." } }, { status: 404 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request); const values = await params; const id = resourceIdSchema.safeParse(values.id); const documentId = resourceIdSchema.safeParse(values.documentId);
    if (!id.success || !documentId.success) throw new InsuranceDocumentNotFoundError();
    return NextResponse.json({ data: await deleteInsuranceDocument(id.data, documentId.data, session.user.id) }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiRequestError) return NextResponse.json({ error: { message: error.message } }, { status: error.status });
    return NextResponse.json({ error: { message: "Belge silinemedi veya bulunamadı." } }, { status: 404 });
  }
}
