import { assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { handleProcessApiError, parseProcessId, processJson } from "@/lib/general-legal-cases/process-api";
import { updateGeneralCaseHearingSchema } from "@/lib/general-legal-cases/process-input";
import { deleteGeneralCaseHearing, updateGeneralCaseHearing } from "@/lib/general-legal-cases/process-service";

type Context = { params: Promise<{ id: string; hearingId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request); const values = await params;
    const validation = updateGeneralCaseHearingSchema.safeParse(await readJsonBody(request));
    if (!validation.success) return processJson({ error: { code: "VALIDATION_ERROR", message: "Duruşma bilgileri geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    return processJson({ data: await updateGeneralCaseHearing(parseProcessId(values.id), parseProcessId(values.hearingId), validation.data, { id: session.user.id, role: session.user.role }) }, 200);
  } catch (error) { return handleProcessApiError(error, "Duruşma güncellenemedi."); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request); const values = await params;
    return processJson({ data: await deleteGeneralCaseHearing(parseProcessId(values.id), parseProcessId(values.hearingId), { id: session.user.id, role: session.user.role }) }, 200);
  } catch (error) { return handleProcessApiError(error, "Duruşma silinemedi."); }
}
