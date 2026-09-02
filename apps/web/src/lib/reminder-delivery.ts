import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./database";
import { sendReminderEmail } from "./email";
import { aggregateReminderStatus, eligibleReminderRecipient, isAllowedReminderAddress, reminderFailureDecision } from "./reminder-delivery-policy";

type BatchOptions = {
  now?: Date;
  // Internal integration tests can isolate their fixtures; not exposed as an HTTP endpoint.
  reminderIds?: string[];
  send?: typeof sendReminderEmail;
};

async function refreshReminder(transaction: Prisma.TransactionClient, reminderId: string, now: Date) {
  await transaction.$queryRaw`SELECT "id" FROM "case_reminder" WHERE "id" = ${reminderId} FOR UPDATE`;
  const reminder = await transaction.caseReminder.findUnique({ where: { id: reminderId }, select: { status: true } });
  if (!reminder || reminder.status === "CANCELLED") return;
  const deliveries = await transaction.reminderDelivery.findMany({ where: { reminderId }, select: { status: true } });
  const status = aggregateReminderStatus(deliveries.map((delivery) => delivery.status));
  await transaction.caseReminder.update({ where: { id: reminderId }, data: { status, sentAt: status === "SENT" ? now : null } });
}

async function prepareReminder(id: string, now: Date) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "case_reminder" WHERE "id" = ${id} FOR UPDATE`;
    const reminder = await transaction.caseReminder.findUnique({ where: { id }, include: { caseFile: { select: { archivedAt: true } } } });
    if (!reminder || reminder.deliveryPreparedAt || reminder.status !== "PENDING" || !reminder.sendEmail || reminder.caseFile.archivedAt || reminder.dueAt > now || reminder.nextPreparationAt > now) return;
    const admins = await transaction.user.findMany({
      where: { role: "admin", emailVerified: true, OR: [{ banned: false }, { banned: null }] },
      select: { id: true, email: true }, orderBy: { id: "asc" },
    });
    const recipients = admins.filter((admin) => isAllowedReminderAddress(admin.email));
    if (!recipients.length) {
      await transaction.caseReminder.update({ where: { id }, data: { nextPreparationAt: new Date(now.getTime() + 5 * 60_000) } });
      return;
    }
    await transaction.reminderDelivery.createMany({
      data: recipients.map((admin) => ({ reminderId: id, recipientId: admin.id, recipientEmail: admin.email, nextAttemptAt: now })),
      skipDuplicates: true,
    });
    await transaction.caseReminder.update({ where: { id }, data: { deliveryPreparedAt: now } });
  });
}

export async function processReminderBatch(options: BatchOptions = {}) {
  const now = options.now ?? new Date();
  const scope = options.reminderIds ? { reminderId: { in: options.reminderIds } } : {};
  // A crashed worker may have sent the email before persisting success. Never reclaim for automatic resend.
  const stale = await prisma.reminderDelivery.findMany({
    where: { ...scope, status: "PROCESSING", startedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
    take: 100, select: { id: true, reminderId: true },
  });
  for (const delivery of stale) {
    await prisma.$transaction(async (transaction) => {
      await transaction.reminderDelivery.updateMany({ where: { id: delivery.id, status: "PROCESSING", startedAt: { lt: new Date(now.getTime() - 10 * 60_000) } }, data: { status: "UNCERTAIN", failureCode: "WORKER_INTERRUPTED" } });
      await refreshReminder(transaction, delivery.reminderId, now);
    });
  }
  const due = await prisma.caseReminder.findMany({
    where: { ...(options.reminderIds ? { id: { in: options.reminderIds } } : {}), status: "PENDING", sendEmail: true, dueAt: { lte: now }, deliveryPreparedAt: null, nextPreparationAt: { lte: now }, caseFile: { archivedAt: null } },
    select: { id: true }, orderBy: [{ dueAt: "asc" }, { id: "asc" }], take: 50,
  });
  for (const reminder of due) await prepareReminder(reminder.id, now);

  const queue = await prisma.reminderDelivery.findMany({
    where: { ...scope, status: "PENDING", nextAttemptAt: { lte: now } },
    orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }], take: 25, select: { id: true },
  });
  let sent = 0;
  for (const candidate of queue) {
    const attemptNow = options.now ?? new Date();
    const claimed = await prisma.reminderDelivery.updateMany({
      where: { id: candidate.id, status: "PENDING", nextAttemptAt: { lte: attemptNow } },
      data: { status: "PROCESSING", startedAt: attemptNow, attempts: { increment: 1 }, failureCode: null },
    });
    if (!claimed.count) continue;
    const delivery = await prisma.reminderDelivery.findUniqueOrThrow({
      where: { id: candidate.id }, include: { recipient: true, reminder: { include: { caseFile: true } } },
    });
    let data: Prisma.ReminderDeliveryUpdateManyMutationInput;
    if (!eligibleReminderRecipient(delivery.recipient) || delivery.recipient.email !== delivery.recipientEmail || delivery.reminder.caseFile.archivedAt || !delivery.reminder.sendEmail || delivery.reminder.status === "CANCELLED") {
      data = { status: "CANCELLED", failureCode: "RECIPIENT_OR_REMINDER_INACTIVE" };
    } else if (!isAllowedReminderAddress(delivery.recipientEmail)) {
      // A transport/allowlist change must not leak queued acceptance mail onto the internet.
      data = { status: "PENDING", attempts: { decrement: 1 }, startedAt: null, nextAttemptAt: new Date(attemptNow.getTime() + 5 * 60_000), failureCode: "RECIPIENT_NOT_ALLOWED" };
    } else {
      try {
        const result = await (options.send ?? sendReminderEmail)({
          to: delivery.recipientEmail, recipientName: delivery.recipient.name,
          reminderId: delivery.reminderId, title: delivery.reminder.title,
          referenceNumber: delivery.reminder.caseFile.referenceNumber, dueAt: delivery.reminder.dueAt,
        });
        if (result.status === "sent") {
          sent++;
          data = { status: "SENT", sentAt: options.now ?? new Date(), failureCode: null };
        } else {
          data = { status: "PENDING", attempts: { decrement: 1 }, startedAt: null, nextAttemptAt: new Date(attemptNow.getTime() + Math.max(60, result.retryAfterSeconds) * 1_000), failureCode: "RATE_LIMITED" };
        }
      } catch (error) {
        const decision = reminderFailureDecision(error, delivery.attempts);
        data = { status: decision.status, failureCode: decision.code, nextAttemptAt: new Date(attemptNow.getTime() + decision.delayMs) };
      }
    }
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.reminderDelivery.updateMany({ where: { id: delivery.id, status: "PROCESSING", startedAt: attemptNow }, data });
      if (updated.count) {
        await transaction.auditLog.create({ data: {
          event: "reminder.delivery_processed", targetType: "case_reminder", targetId: delivery.reminderId,
          context: { deliveryId: delivery.id, recipientId: delivery.recipientId, status: String(data.status), failureCode: typeof data.failureCode === "string" ? data.failureCode : null },
        } });
      }
      await refreshReminder(transaction, delivery.reminderId, options.now ?? new Date());
    });
  }
  return { prepared: due.length, processed: queue.length, sent, interrupted: stale.length };
}
