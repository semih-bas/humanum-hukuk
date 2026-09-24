import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { storeInsuranceDocument, InsuranceDocumentNotFoundError, updateInsuranceDocumentFolders } from "@/lib/insurance-arbitration/document-storage";
import { documentFolderKeySchema, updateDocumentFoldersSchema } from "@/lib/document-folder-input";
import { DocumentValidationError, MAX_MULTIPART_BYTES } from "@/lib/document-validation";
import { DocumentQuotaExceededError, documentStorageLimits, documentUploadRateLimitKey } from "@/lib/document-limits";
import { consumeDurableRateLimit } from "@/lib/email-rate-limit";
import { resourceIdSchema } from "@/lib/resource-id";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request);
    const id = resourceIdSchema.safeParse((await params).id); if (!id.success) throw new InsuranceDocumentNotFoundError();
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data;")) throw new ApiRequestError(415, "UNSUPPORTED_MEDIA_TYPE", "Belge multipart/form-data biçiminde gönderilmelidir.");
    const length = Number(request.headers.get("content-length"));
    if (!Number.isFinite(length) || length <= 0) throw new ApiRequestError(411, "LENGTH_REQUIRED", "Belge boyutu doğrulanamadı.");
    if (length > MAX_MULTIPART_BYTES) throw new ApiRequestError(413, "PAYLOAD_TOO_LARGE", "Belge 20 MB sınırını aşıyor.");

    const uploadAttempt = await consumeDurableRateLimit(documentUploadRateLimitKey(session.user.id), {
      max: documentStorageLimits().maxUploadsPerUserHour,
      windowMs: 60 * 60 * 1_000,
    });
    if (!uploadAttempt.allowed) {
      return NextResponse.json(
        { error: { code: "UPLOAD_RATE_LIMITED", message: "Saatlik belge yükleme sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin." } },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(uploadAttempt.retryAfterSeconds) } },
      );
    }
    const data = await request.formData(); const file = data.get("file"); const category = data.get("category") ?? "OTHER"; const folder = data.get("folderKey") ?? category;
    if (!(file instanceof File)) throw new DocumentValidationError("Yüklenecek belge bulunamadı.");
    if (typeof category !== "string" || !["PAYMENT", "NOTIFICATION", "OTHER"].includes(category)) throw new DocumentValidationError("Belge klasörü geçerli değil.");
    const folderKey = documentFolderKeySchema.safeParse(folder); if (!folderKey.success) throw new DocumentValidationError("Belge klasörü geçerli değil.");
    return json({ data: await storeInsuranceDocument(id.data, file, session.user.id, category, folderKey.data) }, 201);
  } catch (error) {
    if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof DocumentValidationError) return json({ error: { code: "VALIDATION_ERROR", message: error.message } }, 400);
    if (error instanceof DocumentQuotaExceededError) return json({ error: { code: error.code, message: error.message } }, 413);
    if (error instanceof InsuranceDocumentNotFoundError) return json({ error: { message: "Dosya bulunamadı." } }, 404);
    console.error("Sigorta/tahkim belgesi yüklenemedi", { error: error instanceof Error ? error.name : "UnknownError" });
    return json({ error: { message: "Belge yüklenemedi." } }, 500);
  }
}
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request); const id = resourceIdSchema.safeParse((await params).id); const input = updateDocumentFoldersSchema.safeParse(await readJsonBody(request));
    if (!id.success) throw new InsuranceDocumentNotFoundError();
    if (!input.success) throw new DocumentValidationError("Klasör bilgileri geçerli değil.");
    return json({ data: await updateInsuranceDocumentFolders(id.data, input.data.folders, session.user.id) }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) return json({ error: { message: error.message } }, error.status);
    if (error instanceof DocumentValidationError) return json({ error: { message: error.message } }, 400);
    if (error instanceof InsuranceDocumentNotFoundError) return json({ error: { message: "Dosya bulunamadı." } }, 404);
    return json({ error: { message: "Klasörler kaydedilemedi." } }, 500);
  }
}
function json(body: unknown, status: number) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
