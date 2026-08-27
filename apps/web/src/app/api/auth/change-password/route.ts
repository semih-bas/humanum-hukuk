import { NextResponse } from "next/server";

import { auth, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth";
import { ApiRequestError, assertSameOrigin, readJsonBody } from "@/lib/api-security";
import { prisma } from "@/lib/database";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || session.user.banned) {
      throw new ApiRequestError(401, "UNAUTHORIZED", "Bu işlem için giriş yapmalısınız.");
    }
    const body = await readJsonBody(request);
    const input = body as Record<string, unknown>;
    const currentPassword = typeof input.currentPassword === "string" ? input.currentPassword : "";
    const newPassword = typeof input.newPassword === "string" ? input.newPassword : "";
    const newPasswordConfirmation = typeof input.newPasswordConfirmation === "string" ? input.newPasswordConfirmation : "";

    if (newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > PASSWORD_MAX_LENGTH) {
      throw new ApiRequestError(422, "INVALID_PASSWORD", `Yeni şifre ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} karakter arasında olmalıdır.`);
    }
    if (!currentPassword || newPassword !== newPasswordConfirmation) {
      throw new ApiRequestError(422, "PASSWORD_MISMATCH", "Yeni şifre alanları eşleşmiyor.");
    }

    await auth.api.changePassword({
      headers: request.headers,
      body: { currentPassword, newPassword, revokeOtherSessions: true },
    });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { mustChangePassword: false },
    });

    return NextResponse.json({ data: { changed: true } });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "PASSWORD_CHANGE_FAILED", message: "Şifre değiştirilemedi. Mevcut geçici şifrenizi kontrol edin." } }, { status: 422 });
  }
}
