import { ApiRequestError, assertSameOrigin, requireApiSession } from "@/lib/api-security";
import { storeInsuranceDocument, InsuranceDocumentNotFoundError } from "@/lib/insurance-arbitration/document-storage";
import { DocumentValidationError, MAX_MULTIPART_BYTES } from "@/lib/document-validation";
import { resourceIdSchema } from "@/lib/resource-id";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request);
    const id = resourceIdSchema.safeParse((await params).id); if (!id.success) throw new InsuranceDocumentNotFoundError();
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data;")) throw new DocumentValidationError("Belge biçimi geçerli değil.");
    const length = Number(request.headers.get("content-length"));
    if (!Number.isFinite(length) || length <= 0 || length > MAX_MULTIPART_BYTES) throw new DocumentValidationError("Belge 20 MB sınırını aşıyor.");
    const data = await request.formData(); const file = data.get("file");
    if (!(file instanceof File)) throw new DocumentValidationError("Yüklenecek belge bulunamadı.");
    return json({ data: await storeInsuranceDocument(id.data, file, session.user.id) }, 201);
  } catch (error) {
    if (error instanceof ApiRequestError) return json({ error: { message: error.message } }, error.status);
    if (error instanceof DocumentValidationError) return json({ error: { message: error.message } }, 400);
    if (error instanceof InsuranceDocumentNotFoundError) return json({ error: { message: "Dosya bulunamadı." } }, 404);
    console.error("Sigorta/tahkim belgesi yüklenemedi", { error: error instanceof Error ? error.name : "UnknownError" });
    return json({ error: { message: "Belge yüklenemedi." } }, 500);
  }
}
function json(body: unknown, status: number) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
