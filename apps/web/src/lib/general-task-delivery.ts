import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./database";
import { sendReminderEmail } from "./email";
import { aggregateReminderStatus, eligibleReminderRecipient, isAllowedReminderAddress, reminderFailureDecision } from "./reminder-delivery-policy";

type Options = { now?: Date; send?: typeof sendReminderEmail };
async function refresh(transaction: Prisma.TransactionClient, taskId: string, now: Date) {
  await transaction.$queryRaw`SELECT "id" FROM "general_case_task" WHERE "id" = ${taskId} FOR UPDATE`;
  const task = await transaction.generalCaseTask.findUnique({ where: { id: taskId }, select: { status: true } });
  if (!task || task.status === "CANCELLED") return;
  const deliveries = await transaction.generalTaskDelivery.findMany({ where: { taskId }, select: { status: true } });
  const status = aggregateReminderStatus(deliveries.map((delivery) => delivery.status));
  await transaction.generalCaseTask.update({ where: { id: taskId }, data: { status, sentAt: status === "SENT" ? now : null } });
}
async function prepare(id: string, now: Date) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "general_case_task" WHERE "id" = ${id} FOR UPDATE`;
    const task = await transaction.generalCaseTask.findUnique({ where: { id }, include: { case: { select: { archivedAt: true } } } });
    if (!task || task.deliveryPreparedAt || !["PENDING", "PLANNED"].includes(task.status) || task.deletedAt || task.case.archivedAt || !task.notifyAt || task.notifyAt > now || task.nextPreparationAt > now) return;
    const admins = await transaction.user.findMany({ where: { role: "admin", emailVerified: true, OR: [{ banned: false }, { banned: null }] }, select: { id: true, email: true }, orderBy: { id: "asc" } });
    const recipients = admins.filter((admin) => isAllowedReminderAddress(admin.email));
    if (!recipients.length) { await transaction.generalCaseTask.update({ where: { id }, data: { nextPreparationAt: new Date(now.getTime() + 5 * 60_000) } }); return; }
    await transaction.generalTaskDelivery.createMany({ data: recipients.map((admin) => ({ taskId: id, recipientId: admin.id, recipientEmail: admin.email, nextAttemptAt: now })), skipDuplicates: true });
    await transaction.generalCaseTask.update({ where: { id }, data: { deliveryPreparedAt: now, status: "PENDING" } });
  });
}
export async function processGeneralTaskBatch(options: Options = {}) {
  const now = options.now ?? new Date();
  const stale = await prisma.generalTaskDelivery.findMany({ where: { status: "PROCESSING", startedAt: { lt: new Date(now.getTime() - 10 * 60_000) } }, take: 100, select: { id: true, taskId: true } });
  for (const delivery of stale) await prisma.$transaction(async (transaction) => { await transaction.generalTaskDelivery.updateMany({ where: { id: delivery.id, status: "PROCESSING" }, data: { status: "UNCERTAIN", failureCode: "WORKER_INTERRUPTED" } }); await refresh(transaction, delivery.taskId, now); });
  const due = await prisma.generalCaseTask.findMany({ where: { status: { in: ["PENDING", "PLANNED"] }, deletedAt: null, notifyAt: { lte: now }, deliveryPreparedAt: null, nextPreparationAt: { lte: now }, case: { archivedAt: null } }, select: { id: true }, orderBy: [{ notifyAt: "asc" }, { id: "asc" }], take: 50 });
  for (const task of due) await prepare(task.id, now);
  const queue = await prisma.generalTaskDelivery.findMany({ where: { status: "PENDING", nextAttemptAt: { lte: now } }, orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }], take: 25, select: { id: true } });
  let sent = 0;
  for (const candidate of queue) {
    const attemptNow = options.now ?? new Date();
    const claimed = await prisma.generalTaskDelivery.updateMany({ where: { id: candidate.id, status: "PENDING", nextAttemptAt: { lte: attemptNow } }, data: { status: "PROCESSING", startedAt: attemptNow, attempts: { increment: 1 }, failureCode: null } }); if (!claimed.count) continue;
    const delivery = await prisma.generalTaskDelivery.findUniqueOrThrow({ where: { id: candidate.id }, include: { recipient: true, task: { include: { case: true } } } });
    let data: Prisma.GeneralTaskDeliveryUpdateManyMutationInput;
    if (!eligibleReminderRecipient(delivery.recipient) || delivery.recipient.email !== delivery.recipientEmail || delivery.task.deletedAt || delivery.task.case.archivedAt || delivery.task.status === "CANCELLED") data = { status: "CANCELLED", failureCode: "RECIPIENT_OR_NOTIFICATION_INACTIVE" };
    else if (!isAllowedReminderAddress(delivery.recipientEmail)) data = { status: "PENDING", attempts: { decrement: 1 }, startedAt: null, nextAttemptAt: new Date(attemptNow.getTime() + 5 * 60_000), failureCode: "RECIPIENT_NOT_ALLOWED" };
    else { try { const result = await (options.send ?? sendReminderEmail)({ to: delivery.recipientEmail, recipientName: delivery.recipient.name, reminderId: delivery.taskId, title: delivery.task.title, referenceNumber: delivery.task.case.referenceNumber, dueAt: delivery.task.dueAt, source: "general" }); if (result.status === "sent") { sent++; data = { status: "SENT", sentAt: options.now ?? new Date(), failureCode: null }; } else data = { status: "PENDING", attempts: { decrement: 1 }, startedAt: null, nextAttemptAt: new Date(attemptNow.getTime() + Math.max(60, result.retryAfterSeconds) * 1_000), failureCode: "RATE_LIMITED" }; } catch (error) { const decision = reminderFailureDecision(error, delivery.attempts); data = { status: decision.status, failureCode: decision.code, nextAttemptAt: new Date(attemptNow.getTime() + decision.delayMs) }; } }
    await prisma.$transaction(async (transaction) => { await transaction.generalTaskDelivery.updateMany({ where: { id: delivery.id, status: "PROCESSING", startedAt: attemptNow }, data }); await refresh(transaction, delivery.taskId, options.now ?? new Date()); });
  }
  return { prepared: due.length, processed: queue.length, sent, interrupted: stale.length };
}
