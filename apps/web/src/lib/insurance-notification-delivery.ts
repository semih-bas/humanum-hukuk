import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./database";
import { sendReminderEmail } from "./email";
import { aggregateReminderStatus, eligibleReminderRecipient, isAllowedReminderAddress, reminderFailureDecision } from "./reminder-delivery-policy";

type Options = { now?: Date; send?: typeof sendReminderEmail };

async function refresh(transaction: Prisma.TransactionClient, notificationId: string, now: Date) {
  await transaction.$queryRaw`SELECT "id" FROM "insurance_arbitration_notification" WHERE "id" = ${notificationId} FOR UPDATE`;
  const notification = await transaction.insuranceArbitrationNotification.findUnique({ where: { id: notificationId }, select: { status: true } });
  if (!notification || notification.status === "CANCELLED") return;
  const deliveries = await transaction.insuranceNotificationDelivery.findMany({ where: { notificationId }, select: { status: true } });
  const status = aggregateReminderStatus(deliveries.map((delivery) => delivery.status));
  await transaction.insuranceArbitrationNotification.update({ where: { id: notificationId }, data: { status, sentAt: status === "SENT" ? now : null } });
}

async function prepare(id: string, now: Date) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "insurance_arbitration_notification" WHERE "id" = ${id} FOR UPDATE`;
    const notification = await transaction.insuranceArbitrationNotification.findUnique({ where: { id }, include: { case: { select: { archivedAt: true } } } });
    if (!notification || notification.deliveryPreparedAt || notification.status !== "PENDING" || notification.deletedAt || notification.case.archivedAt || notification.notifyAt > now || notification.nextPreparationAt > now) return;
    const admins = await transaction.user.findMany({
      where: { role: "admin", emailVerified: true, OR: [{ banned: false }, { banned: null }] },
      select: { id: true, email: true }, orderBy: { id: "asc" },
    });
    const recipients = admins.filter((admin) => isAllowedReminderAddress(admin.email));
    if (!recipients.length) {
      await transaction.insuranceArbitrationNotification.update({ where: { id }, data: { nextPreparationAt: new Date(now.getTime() + 5 * 60_000) } });
      return;
    }
    await transaction.insuranceNotificationDelivery.createMany({
      data: recipients.map((admin) => ({ notificationId: id, recipientId: admin.id, recipientEmail: admin.email, nextAttemptAt: now })),
      skipDuplicates: true,
    });
    await transaction.insuranceArbitrationNotification.update({ where: { id }, data: { deliveryPreparedAt: now } });
  });
}

export async function processInsuranceNotificationBatch(options: Options = {}) {
  const now = options.now ?? new Date();
  const stale = await prisma.insuranceNotificationDelivery.findMany({
    where: { status: "PROCESSING", startedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
    take: 100, select: { id: true, notificationId: true },
  });
  for (const delivery of stale) {
    await prisma.$transaction(async (transaction) => {
      await transaction.insuranceNotificationDelivery.updateMany({ where: { id: delivery.id, status: "PROCESSING", startedAt: { lt: new Date(now.getTime() - 10 * 60_000) } }, data: { status: "UNCERTAIN", failureCode: "WORKER_INTERRUPTED" } });
      await refresh(transaction, delivery.notificationId, now);
    });
  }

  const due = await prisma.insuranceArbitrationNotification.findMany({
    where: { status: "PENDING", deletedAt: null, notifyAt: { lte: now }, deliveryPreparedAt: null, nextPreparationAt: { lte: now }, case: { archivedAt: null } },
    select: { id: true }, orderBy: [{ notifyAt: "asc" }, { id: "asc" }], take: 50,
  });
  for (const notification of due) await prepare(notification.id, now);

  const queue = await prisma.insuranceNotificationDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: now } },
    orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }], take: 25, select: { id: true },
  });
  let sent = 0;
  for (const candidate of queue) {
    const attemptNow = options.now ?? new Date();
    const claimed = await prisma.insuranceNotificationDelivery.updateMany({
      where: { id: candidate.id, status: "PENDING", nextAttemptAt: { lte: attemptNow } },
      data: { status: "PROCESSING", startedAt: attemptNow, attempts: { increment: 1 }, failureCode: null },
    });
    if (!claimed.count) continue;
    const delivery = await prisma.insuranceNotificationDelivery.findUniqueOrThrow({
      where: { id: candidate.id }, include: { recipient: true, notification: { include: { case: true } } },
    });
    let data: Prisma.InsuranceNotificationDeliveryUpdateManyMutationInput;
    if (!eligibleReminderRecipient(delivery.recipient) || delivery.recipient.email !== delivery.recipientEmail || delivery.notification.deletedAt || delivery.notification.case.archivedAt || delivery.notification.status === "CANCELLED") {
      data = { status: "CANCELLED", failureCode: "RECIPIENT_OR_NOTIFICATION_INACTIVE" };
    } else if (!isAllowedReminderAddress(delivery.recipientEmail)) {
      data = { status: "PENDING", attempts: { decrement: 1 }, startedAt: null, nextAttemptAt: new Date(attemptNow.getTime() + 5 * 60_000), failureCode: "RECIPIENT_NOT_ALLOWED" };
    } else {
      try {
        const result = await (options.send ?? sendReminderEmail)({
          to: delivery.recipientEmail, recipientName: delivery.recipient.name,
          reminderId: delivery.notificationId, title: delivery.notification.title,
          referenceNumber: delivery.notification.case.referenceNumber, dueAt: delivery.notification.eventAt,
          source: "insurance",
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
      const updated = await transaction.insuranceNotificationDelivery.updateMany({ where: { id: delivery.id, status: "PROCESSING", startedAt: attemptNow }, data });
      if (updated.count) await transaction.auditLog.create({ data: {
        event: "insurance_notification.delivery_processed", targetType: "insurance_arbitration_notification", targetId: delivery.notificationId,
        context: { deliveryId: delivery.id, recipientId: delivery.recipientId, status: String(data.status), failureCode: typeof data.failureCode === "string" ? data.failureCode : null },
      } });
      await refresh(transaction, delivery.notificationId, options.now ?? new Date());
    });
  }
  return { prepared: due.length, processed: queue.length, sent, interrupted: stale.length };
}
