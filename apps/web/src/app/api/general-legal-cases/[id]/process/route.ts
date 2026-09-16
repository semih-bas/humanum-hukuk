import { requireApiSession } from "@/lib/api-security";
import { handleProcessApiError, parseProcessId, processJson } from "@/lib/general-legal-cases/process-api";
import { getGeneralCaseProcess } from "@/lib/general-legal-cases/process-service";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const session = await requireApiSession(request);
    const caseId = parseProcessId((await params).id, "Dosya bulunamadı.");
    return processJson({ data: await getGeneralCaseProcess(caseId, { id: session.user.id, role: session.user.role }) }, 200);
  } catch (error) { return handleProcessApiError(error, "Dava süreci yüklenemedi."); }
}
