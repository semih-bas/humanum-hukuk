import { assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { handleProcessApiError, parseProcessId, processJson } from "@/lib/general-legal-cases/process-api";
import { createGeneralCaseHearingSchema } from "@/lib/general-legal-cases/process-input";
import { createGeneralCaseHearing } from "@/lib/general-legal-cases/process-service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request);
    const validation = createGeneralCaseHearingSchema.safeParse(await readJsonBody(request));
    if (!validation.success) return processJson({ error: { code: "VALIDATION_ERROR", message: "Duruşma bilgileri geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    const caseId = parseProcessId((await params).id, "Dosya bulunamadı.");
    return processJson({ data: await createGeneralCaseHearing(caseId, validation.data, { id: session.user.id, role: session.user.role }) }, 201);
  } catch (error) { return handleProcessApiError(error, "Duruşma eklenemedi."); }
}
