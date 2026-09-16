import { assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { handleProcessApiError, parseProcessId, processJson } from "@/lib/general-legal-cases/process-api";
import { updateGeneralCaseProcessEntrySchema } from "@/lib/general-legal-cases/process-input";
import { deleteGeneralCaseProcessEntry, updateGeneralCaseProcessEntry } from "@/lib/general-legal-cases/process-service";

type Context = { params: Promise<{ id: string; entryId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request); const values = await params;
    const validation = updateGeneralCaseProcessEntrySchema.safeParse(await readJsonBody(request));
    if (!validation.success) return processJson({ error: { code: "VALIDATION_ERROR", message: "Süreç işlemi geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    return processJson({ data: await updateGeneralCaseProcessEntry(parseProcessId(values.id), parseProcessId(values.entryId), validation.data, { id: session.user.id, role: session.user.role }) }, 200);
  } catch (error) { return handleProcessApiError(error, "Süreç işlemi güncellenemedi."); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request); const values = await params;
    return processJson({ data: await deleteGeneralCaseProcessEntry(parseProcessId(values.id), parseProcessId(values.entryId), { id: session.user.id, role: session.user.role }) }, 200);
  } catch (error) { return handleProcessApiError(error, "Süreç işlemi silinemedi."); }
}
