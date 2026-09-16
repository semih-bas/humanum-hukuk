import { assertSameOrigin, readJsonBody, requireApiSession } from "@/lib/api-security";
import { handleProcessApiError, parseProcessId, processJson } from "@/lib/general-legal-cases/process-api";
import { createGeneralCaseProcessEntrySchema } from "@/lib/general-legal-cases/process-input";
import { createGeneralCaseProcessEntry } from "@/lib/general-legal-cases/process-service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request); const session = await requireApiSession(request);
    const validation = createGeneralCaseProcessEntrySchema.safeParse(await readJsonBody(request));
    if (!validation.success) return processJson({ error: { code: "VALIDATION_ERROR", message: "Süreç işlemi geçerli değil.", fields: validation.error.flatten().fieldErrors } }, 400);
    const caseId = parseProcessId((await params).id, "Dosya bulunamadı.");
    return processJson({ data: await createGeneralCaseProcessEntry(caseId, validation.data, { id: session.user.id, role: session.user.role }) }, 201);
  } catch (error) { return handleProcessApiError(error, "Süreç işlemi eklenemedi."); }
}
