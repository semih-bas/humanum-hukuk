import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { ApiRequestError, assertSameOrigin, readJsonBody } from "@/lib/api-security";
import { prisma } from "@/lib/database";
import { validateUserStatusChange } from "@/lib/user-status";

const ADMIN_STATUS_LOCK_ID = 4_452_631_118;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || session.user.banned || session.user.role !== "admin") {
      throw new ApiRequestError(403, "ADMIN_REQUIRED", "Bu işlem yalnızca yöneticilere açıktır.");
    }

    const body = await readJsonBody(request) as Record<string, unknown>;
    const userId = typeof body.userId === "string" ? body.userId : "";
    const action = body.action === "ban" || body.action === "unban" ? body.action : "";
    if (!userId || !action) {
      throw new ApiRequestError(400, "INVALID_REQUEST", "Kullanıcı ve işlem bilgisi geçerli olmalıdır.");
    }
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_STATUS_LOCK_ID})`;
      const actor = await transaction.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, banned: true },
      });
      if (!actor || actor.banned || actor.role !== "admin") {
        throw new ApiRequestError(403, "ADMIN_REQUIRED", "Bu işlem yalnızca yöneticilere açıktır.");
      }

      const target = await transaction.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, role: true, banned: true },
      });
      if (!target) throw new ApiRequestError(404, "USER_NOT_FOUND", "Kullanıcı bulunamadı.");

      const activeAdminCount = action === "ban" && target.role === "admin" && !target.banned
        ? await transaction.user.count({ where: { role: "admin", banned: false } })
        : 0;
      const validationMessage = validateUserStatusChange({
        action,
        actorUserId: session.user.id,
        targetUserId: userId,
        targetRole: target.role,
        targetBanned: target.banned === true,
        activeAdminCount,
      });
      if (validationMessage) {
        throw new ApiRequestError(
          validationMessage.includes("son aktif") ? 409 : 400,
          validationMessage.includes("son aktif") ? "LAST_ACTIVE_ADMIN" : "CANNOT_BAN_SELF",
          validationMessage,
        );
      }

      await transaction.user.update({
        where: { id: userId },
        data: action === "ban"
          ? { banned: true, banReason: "Yönetici tarafından pasifleştirildi", banExpires: null }
          : { banned: false, banReason: null, banExpires: null },
      });
      if (action === "ban") await transaction.session.deleteMany({ where: { userId } });
      await transaction.auditLog.create({
        data: {
          actorUserId: session.user.id,
          event: action === "ban" ? "user.deactivated" : "user.activated",
          targetType: "user",
          targetId: userId,
          context: { targetName: target.name },
        },
      });
    });

    return NextResponse.json({ data: { userId, action, banned: action === "ban" } });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "STATUS_CHANGE_FAILED", message: "Kullanıcı durumu değiştirilemedi. Lütfen tekrar deneyin." } }, { status: 500 });
  }
}
