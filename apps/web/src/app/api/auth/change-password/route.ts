import { NextResponse } from "next/server";

import { auth, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth";
import { ApiRequestError, assertSameOrigin, readJsonBody } from "@/lib/api-security";
import { tryWriteAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/database";
import { clearSensitiveActionAttempts, consumeSensitiveActionAttempt } from "@/lib/sensitive-action-rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || session.user.banned) {
      throw new ApiRequestError(401, "UNAUTHORIZED", "Bu işlem için giriş yapmalısınız.");
    }
    const attemptKey = `change-password:${session.user.id}`;
    const attempt = await consumeSensitiveActionAttempt(attemptKey, { max: 5, windowMs: 15 * 60 * 1_000 });
    if (!attempt.allowed) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Çok fazla şifre değiştirme denemesi yapıldı. Lütfen daha sonra tekrar deneyin." } },
        { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } },
      );
    }
    const body = await readJsonBody(request);
    const input = body as Record<string, unknown>;
    const currentPassword = typeof input.currentPassword === "string" ? input.currentPassword : "";
    const newPassword = typeof input.newPassword === "string" ? input.newPassword : "";
    const newPasswordConfirmation = typeof input.newPasswordConfirmation === "string" ? input.newPasswordConfirmation : "";

    if (newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > PASSWORD_MAX_LENGTH) {
      throw new ApiRequestError(422, "INVALID_PASSWORD", `Yeni şifre ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} karakter arasında olmalıdır.`);
    }
    if (newPassword !== newPasswordConfirmation) {
      throw new ApiRequestError(422, "PASSWORD_MISMATCH", "Yeni şifre alanları eşleşmiyor.");
    }

    const accountState = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailVerified: true,
        mustChangePassword: true,
        accounts: { where: { providerId: "credential" }, select: { id: true }, take: 1 },
      },
    });
    const initialPasswordSetup = accountState?.emailVerified === true && accountState.mustChangePassword && accountState.accounts.length === 0;

    if (initialPasswordSetup) {
      await auth.api.setPassword({ headers: request.headers, body: { newPassword } });
    } else {
      if (!currentPassword) throw new ApiRequestError(422, "CURRENT_PASSWORD_REQUIRED", "Mevcut şifrenizi yazmalısınız.");
      await auth.api.changePassword({
        headers: request.headers,
        body: { currentPassword, newPassword, revokeOtherSessions: true },
      });
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { mustChangePassword: false },
    });
    if (initialPasswordSetup) await prisma.session.deleteMany({ where: { userId: session.user.id } });
    await clearSensitiveActionAttempts(attemptKey);
    await tryWriteAuditLog({
      actorUserId: session.user.id,
      event: "auth.password_changed",
      targetType: "user",
      targetId: session.user.id,
      ipAddress: session.session.ipAddress,
    });

    return NextResponse.json({ data: { changed: true, initialPasswordSetup } });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "PASSWORD_CHANGE_FAILED", message: "Şifre değiştirilemedi. Mevcut şifrenizi kontrol edin." } }, { status: 422 });
  }
}
