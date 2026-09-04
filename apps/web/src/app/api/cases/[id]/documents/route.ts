import { ApiRequestError, assertSameOrigin, requireApiSession } from "@/lib/api-security";
import { CaseNotFoundError } from "@/lib/cases/update-case";
import { DocumentQuotaExceededError, DocumentValidationError, MAX_MULTIPART_BYTES, storeCaseDocument } from "@/lib/document-storage";
import { documentStorageLimits } from "@/lib/document-limits";
import { consumeDurableRateLimit } from "@/lib/email-rate-limit";
import { resourceIdSchema } from "@/lib/resource-id";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const idResult = resourceIdSchema.safeParse((await params).id);
    if (!idResult.success) throw new ApiRequestError(404, "NOT_FOUND", "Dosya bulunamadı.");

    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data;")) throw new ApiRequestError(415, "UNSUPPORTED_MEDIA_TYPE", "Evrak multipart/form-data biçiminde gönderilmelidir.");
    const declaredLength = Number(request.headers.get("content-length"));
    if (!Number.isFinite(declaredLength) || declaredLength <= 0) throw new ApiRequestError(411, "LENGTH_REQUIRED", "Evrak boyutu doğrulanamadı.");
    if (declaredLength > MAX_MULTIPART_BYTES) throw new ApiRequestError(413, "PAYLOAD_TOO_LARGE", "Evrak 20 MB sınırını aşıyor.");

    const uploadAttempt = await consumeDurableRateLimit(`document-upload:${session.user.id}`, {
      max: documentStorageLimits().maxUploadsPerUserHour,
      windowMs: 60 * 60 * 1_000,
    });
    if (!uploadAttempt.allowed) {
      return NextResponse.json(
        { error: { code: "UPLOAD_RATE_LIMITED", message: "Saatlik evrak yükleme sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin." } },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(uploadAttempt.retryAfterSeconds) } },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const requestedName = form.get("documentName");
    if (!(file instanceof File)) throw new DocumentValidationError("Yüklenecek evrak bulunamadı.");
    if (requestedName !== null && typeof requestedName !== "string") throw new DocumentValidationError("Evrak adı geçerli değil.");
    return jsonResponse({ data: await storeCaseDocument(idResult.data, file, session.user.id, requestedName ?? undefined) }, 201);
  } catch (error) {
    if (error instanceof ApiRequestError) return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof DocumentValidationError) return jsonResponse({ error: { code: "VALIDATION_ERROR", message: error.message } }, 400);
    if (error instanceof DocumentQuotaExceededError) return jsonResponse({ error: { code: error.code, message: error.message } }, 413);
    if (error instanceof CaseNotFoundError) return jsonResponse({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404);
    console.error("Failed to upload case document", { error: error instanceof Error ? error.name : "UnknownError" });
    return jsonResponse({ error: { code: "INTERNAL_ERROR", message: "Evrak yüklenirken beklenmeyen bir hata oluştu." } }, 500);
  }
}

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
