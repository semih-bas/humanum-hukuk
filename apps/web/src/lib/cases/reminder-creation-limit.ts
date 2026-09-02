import type { Prisma } from "../../generated/prisma/client";

export class ReminderCreationError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ReminderCreationError";
  }
}

export async function lockReminderCreation(transaction: Prisma.TransactionClient, actorUserId: string) {
  // Serialize both creation paths, including concurrent requests from different app instances.
  await transaction.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(723918, 1)`;
  const actor = await transaction.user.findUnique({ where: { id: actorUserId }, select: { banned: true, emailVerified: true } });
  if (!actor || actor.banned || !actor.emailVerified) {
    throw new ReminderCreationError(403, "REMINDER_FORBIDDEN", "Hatırlatma eklemek için aktif ve e-postası doğrulanmış bir hesap gerekir.");
  }
}

export async function checkReminderCreationLimit(transaction: Prisma.TransactionClient, actorUserId: string) {
  const now = Date.now();
  const daily = { createdAt: { gte: new Date(now - 24 * 60 * 60_000) } };
  const [hourCount, dayCount, totalCount] = await Promise.all([
    transaction.caseReminder.count({ where: { createdById: actorUserId, createdAt: { gte: new Date(now - 60 * 60_000) } } }),
    transaction.caseReminder.count({ where: { createdById: actorUserId, ...daily } }),
    transaction.caseReminder.count({ where: daily }),
  ]);
  if (hourCount >= 10 || dayCount >= 30 || totalCount >= 200) {
    throw new ReminderCreationError(429, "REMINDER_RATE_LIMITED", "Hatırlatma ekleme sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.");
  }
}
