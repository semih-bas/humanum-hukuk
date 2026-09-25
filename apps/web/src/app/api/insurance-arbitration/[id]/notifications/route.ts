import { NextResponse } from "next/server";
import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { addInsuranceNotification, InsuranceCaseNotFoundError } from "@/lib/insurance-arbitration/service";
import { notificationInputSchema } from "@/lib/notification-input";
import { resourceIdSchema } from "@/lib/resource-id";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request); const id = resourceIdSchema.safeParse((await params).id);
    if (!id.success) throw new ApiRequestError(404, "NOT_FOUND", "Dosya bulunamadı.");
    const validation = notificationInputSchema.safeParse(await readJsonBody(request));
    if (!validation.success) return json({ error: { message: "Bildirim bilgileri geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    return json({ data: await addInsuranceNotification(id.data, validation.data, session.user.id) }, 201);
  } catch (error) { if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status); if (error instanceof InsuranceCaseNotFoundError) return json({ error: { code: "NOT_FOUND", message: "Dosya bulunamadı." } }, 404); console.error("Failed to add insurance notification", { error: error instanceof Error ? error.name : "UnknownError" }); return json({ error: { code: "INTERNAL_ERROR", message: "Bildirim eklenemedi." } }, 500); }
}
function json(body: unknown, status: number) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
