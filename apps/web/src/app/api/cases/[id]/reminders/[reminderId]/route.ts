import { NextResponse } from "next/server";
import { ApiRequestError, assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { CaseReminderLockedError, deleteCaseReminder, updateCaseReminder } from "@/lib/cases/add-case-activity";
import { CaseNotFoundError } from "@/lib/cases/update-case";
import { notificationInputSchema } from "@/lib/notification-input";
import { resourceIdSchema } from "@/lib/resource-id";

type Context = { params: Promise<{ id: string; reminderId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request); const ids = await readIds(context);
    const validation = notificationInputSchema.safeParse(await readJsonBody(request));
    if (!validation.success) return json({ error: { message: "Bildirim bilgileri geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    return json({ data: await updateCaseReminder(ids.id, ids.reminderId, validation.data, session.user.id) }, 200);
  } catch (error) { return handle(error, "Bildirim güncellenemedi."); }
}

export async function DELETE(request: Request, context: Context) {
  try { assertSameOrigin(request); const session = await requireApiSession(request); const ids = await readIds(context); await deleteCaseReminder(ids.id, ids.reminderId, session.user.id); return json({ data: { deleted: true } }, 200); }
  catch (error) { return handle(error, "Bildirim silinemedi."); }
}

async function readIds(context: Context) { const values = await context.params; const id = resourceIdSchema.safeParse(values.id); const reminderId = resourceIdSchema.safeParse(values.reminderId); if (!id.success || !reminderId.success) throw new ApiRequestError(404, "NOT_FOUND", "Bildirim bulunamadı."); return { id: id.data, reminderId: reminderId.data }; }
function handle(error: unknown, message: string) { if (error instanceof ApiRequestError) return json({ error: { code: error.code, message: error.message } }, error.status); if (error instanceof CaseReminderLockedError) return json({ error: { code: "REMINDER_LOCKED", message: "Gönderim süreci başlamış bildirim düzenlenemez." } }, 409); if (error instanceof CaseNotFoundError) return json({ error: { code: "NOT_FOUND", message: "Bildirim bulunamadı." } }, 404); console.error(message, { error: error instanceof Error ? error.name : "UnknownError" }); return json({ error: { code: "INTERNAL_ERROR", message } }, 500); }
function json(body: unknown, status: number) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
