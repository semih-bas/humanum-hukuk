import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ApiRequestError, assertSameOrigin, readJsonBody } from "@/lib/api-security";
import { prisma } from "@/lib/database";
import { DELETION_RETENTION_DAYS, deletionDueAt, validateUserDeletion } from "@/lib/deletion-policy";

async function requireAdmin(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || session.user.banned || session.user.role !== "admin") throw new ApiRequestError(403, "ADMIN_REQUIRED", "Bu işlem yalnızca yöneticilere açıktır.");
  return session;
}

export async function GET(request: Request) {
  try { await requireAdmin(request); const users = await prisma.user.findMany({ where: { deletionRequestedAt: { not: null } }, select: { id: true } }); return NextResponse.json({ data: { userIds: users.map((user) => user.id) } }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const session = await requireAdmin(request); const body = await readJsonBody(request) as Record<string, unknown>;
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) throw new ApiRequestError(400, "INVALID_USER", "Bu kullanıcı silinemez.");
    const dueAt = deletionDueAt();
    await prisma.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({ where: { id: userId }, select: { id: true, name: true, banned: true, deletionRequestedAt: true } });
      if (!target) throw new ApiRequestError(404, "USER_NOT_FOUND", "Kullanıcı bulunamadı.");
      const validation = validateUserDeletion({ actorUserId: session.user.id, targetUserId: target.id, targetBanned: target.banned === true, alreadyScheduled: target.deletionRequestedAt !== null });
      if (validation) throw new ApiRequestError(400, "USER_DELETION_NOT_ALLOWED", validation);
      await transaction.user.update({ where: { id: userId }, data: { deletionRequestedAt: new Date(), deletionDueAt: dueAt, deletedById: session.user.id, banReason: "Yönetici tarafından silinmek üzere işaretlendi" } });
      await transaction.session.deleteMany({ where: { userId } });
      await transaction.auditLog.create({ data: { actorUserId: session.user.id, event: "user.deletion_scheduled", targetType: "user", targetId: userId, context: { targetName: target.name, dueAt: dueAt.toISOString() } } });
    });
    return NextResponse.json({ data: { userId, retentionDays: DELETION_RETENTION_DAYS, deletionDueAt: dueAt.toISOString() } });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  if (error instanceof ApiRequestError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  return NextResponse.json({ error: { code: "USER_DELETION_FAILED", message: "Kullanıcı silinemedi. Lütfen tekrar deneyin." } }, { status: 500 });
}
