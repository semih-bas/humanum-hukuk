import { auth } from "./auth";
import { prisma } from "./database";
import { requireHttpUrl } from "./environment";

const MAX_JSON_BODY_BYTES = 32 * 1024;

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const expectedOrigin = requireHttpUrl("BETTER_AUTH_URL");

  if (!origin || origin !== expectedOrigin) {
    throw new ApiRequestError(403, "INVALID_ORIGIN", "İstek kaynağı doğrulanamadı.");
  }
}

export async function requireApiSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session || session.user.banned) {
    throw new ApiRequestError(401, "UNAUTHORIZED", "Bu işlem için giriş yapmalısınız.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });

  if (user?.mustChangePassword) {
    throw new ApiRequestError(403, "PASSWORD_CHANGE_REQUIRED", "Devam etmek için şifrenizi değiştirmeniz gerekir.");
  }

  return session;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();

  if (contentType !== "application/json") {
    throw new ApiRequestError(415, "UNSUPPORTED_MEDIA_TYPE", "İstek JSON biçiminde olmalıdır.");
  }

  const declaredLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new ApiRequestError(413, "PAYLOAD_TOO_LARGE", "Gönderilen veri izin verilen boyutu aşıyor.");
  }

  const body = await request.text();

  if (new TextEncoder().encode(body).byteLength > MAX_JSON_BODY_BYTES) {
    throw new ApiRequestError(413, "PAYLOAD_TOO_LARGE", "Gönderilen veri izin verilen boyutu aşıyor.");
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ApiRequestError(400, "INVALID_JSON", "Gönderilen JSON verisi geçerli değil.");
  }
}
