import { ApiRequestError, assertSameOrigin, requireApiSession } from "@/lib/api-security";
import { documentStorageLimits, documentUploadRateLimitKey, DocumentQuotaExceededError } from "@/lib/document-limits";
import { DocumentValidationError, MAX_MULTIPART_BYTES } from "@/lib/document-validation";
import { consumeDurableRateLimit } from "@/lib/email-rate-limit";
import { generalCaseDocumentCategorySchema, generalCaseDocumentFolderKeySchema } from "@/lib/general-legal-cases/document-input";
import { GeneralCaseDocumentNotFoundError, listGeneralCaseDocuments, storeGeneralCaseDocument } from "@/lib/general-legal-cases/document-storage";
import { resourceIdSchema } from "@/lib/resource-id";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const session = await requireApiSession(request);
    const id = resourceIdSchema.safeParse((await params).id); if (!id.success) throw new GeneralCaseDocumentNotFoundError();
    return json({ data: await listGeneralCaseDocuments(id.data, { id: session.user.id, role: session.user.role }) }, 200);
  } catch (error) { return handleError(error, "Evraklar yüklenemedi."); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request);
    const id = resourceIdSchema.safeParse((await params).id); if (!id.success) throw new GeneralCaseDocumentNotFoundError();
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data;")) throw new ApiRequestError(415, "UNSUPPORTED_MEDIA_TYPE", "Evrak multipart/form-data biçiminde gönderilmelidir.");
    const length = Number(request.headers.get("content-length"));
    if (!Number.isFinite(length) || length <= 0) throw new ApiRequestError(411, "LENGTH_REQUIRED", "Evrak boyutu doğrulanamadı.");
    if (length > MAX_MULTIPART_BYTES) throw new ApiRequestError(413, "PAYLOAD_TOO_LARGE", "Evrak 20 MB sınırını aşıyor.");
    const attempt = await consumeDurableRateLimit(documentUploadRateLimitKey(session.user.id), { max: documentStorageLimits().maxUploadsPerUserHour, windowMs: 60 * 60 * 1_000 });
    if (!attempt.allowed) return NextResponse.json({ error: { code: "UPLOAD_RATE_LIMITED", message: "Saatlik evrak yükleme sınırına ulaşıldı." } }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(attempt.retryAfterSeconds) } });

    const data = await request.formData(); const file = data.get("file");
    const category = generalCaseDocumentCategorySchema.safeParse(data.get("category"));
    const rawFolderKey = data.get("folderKey");
    const folderKey = rawFolderKey ? generalCaseDocumentFolderKeySchema.safeParse(rawFolderKey) : null;
    if (!(file instanceof File)) throw new DocumentValidationError("Yüklenecek evrak bulunamadı.");
    if (!category.success) throw new DocumentValidationError(category.error.issues[0]?.message ?? "Evrak kategorisi geçerli değildir.");
    if (folderKey && !folderKey.success) throw new DocumentValidationError(folderKey.error.issues[0]?.message ?? "Evrak klasörü geçerli değildir.");
    return json({ data: await storeGeneralCaseDocument(id.data, file, category.data, folderKey?.data ?? null, { id: session.user.id, role: session.user.role }) }, 201);
  } catch (error) { return handleError(error, "Evrak yüklenemedi."); }
}

function handleError(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof DocumentValidationError) return json({ error: { code: "VALIDATION_ERROR", message: error.message } }, 400);
  if (error instanceof DocumentQuotaExceededError) return json({ error: { code: error.code, message: error.message } }, 413);
  if (error instanceof GeneralCaseDocumentNotFoundError) return json({ error: { message: "Dosya bulunamadı." } }, 404);
  console.error("Genel dava evrak işlemi başarısız", { error: error instanceof Error ? error.name : "UnknownError" });
  return json({ error: { message: fallback } }, 500);
}
function json(body: unknown, status: number) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
