import { prisma } from "../database";

import type { z } from "zod";
import type { addCaseNoteSchema, addCaseReminderSchema } from "./create-case-input";
import { CaseNotFoundError } from "./update-case";
import { checkReminderCreationLimit, lockReminderCreation } from "./reminder-creation-limit";
import type { NotificationInput } from "../notification-input";
import { notificationTime } from "../notification-schedule";

type NoteInput = z.infer<typeof addCaseNoteSchema>;
type ReminderInput = NotificationInput | z.infer<typeof addCaseReminderSchema>;

export async function addCaseNote(caseFileId: string, input: NoteInput, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const caseFile = await transaction.caseFile.findFirst({
      where: { id: caseFileId, archivedAt: null },
      select: { id: true, referenceNumber: true },
    });
    if (!caseFile) throw new CaseNotFoundError();

    const note = await transaction.caseNote.create({
      data: { caseFileId, authorId: actorUserId, content: input.content.trim() },
      select: { id: true, createdAt: true, author: { select: { name: true } } },
    });
    await transaction.auditLog.create({
      data: { actorUserId, event: "case.note_added", targetType: "case_file", targetId: caseFileId, context: { referenceNumber: caseFile.referenceNumber } },
    });
    return { id: note.id, createdAt: note.createdAt.toISOString(), author: note.author };
  });
}

export async function deleteCaseNote(caseFileId: string, noteId: string, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const caseFile = await transaction.caseFile.findFirst({ where: { id: caseFileId, archivedAt: null }, select: { referenceNumber: true } });
    if (!caseFile) throw new CaseNotFoundError();
    const result = await transaction.caseNote.updateMany({ where: { id: noteId, caseFileId, deletedAt: null }, data: { deletedAt: new Date(), deletedById: actorUserId } });
    if (result.count !== 1) throw new CaseNotFoundError();
    await transaction.auditLog.create({ data: { actorUserId, event: "case.note_deleted", targetType: "case_file", targetId: caseFileId, context: { referenceNumber: caseFile.referenceNumber, noteId } } });
  });
}

export async function addCaseReminder(caseFileId: string, input: ReminderInput, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    await lockReminderCreation(transaction, actorUserId);
    const caseFile = await transaction.caseFile.findFirst({
      where: { id: caseFileId, archivedAt: null },
      select: { id: true, referenceNumber: true },
    });
    if (!caseFile) throw new CaseNotFoundError();

    const detailed = "eventAt" in input;
    const eventAt = detailed ? input.eventAt : input.dueAt;
    const priority = detailed ? input.priority : "MEDIUM";
    const notifyAt = detailed ? notificationTime(eventAt, priority) : eventAt;
    const existing = await transaction.caseReminder.findFirst({
      where: { caseFileId, title: input.title, eventAt, status: { not: "CANCELLED" } },
      select: reminderSelect,
    });
    if (existing) return presentReminder(existing);
    await checkReminderCreationLimit(transaction, actorUserId);
    const reminder = await transaction.caseReminder.create({
      data: {
        caseFileId,
        createdById: actorUserId,
        title: input.title,
        description: detailed ? input.description : null,
        reminderType: detailed ? input.reminderType : null,
        priority,
        eventAt,
        dueAt: notifyAt,
        nextPreparationAt: notifyAt.getTime() > Date.now() ? notifyAt : new Date(),
        sendEmail: true,
        sendSms: false,
      },
      select: reminderSelect,
    });
    await transaction.auditLog.create({
      data: {
        actorUserId,
        event: "case.reminder_added",
        targetType: "case_file",
        targetId: caseFileId,
        context: { referenceNumber: caseFile.referenceNumber, eventAt: reminder.eventAt.toISOString(), notifyAt: reminder.dueAt.toISOString(), priority: reminder.priority, deliveryChannel: "email" },
      },
    });
    return presentReminder(reminder);
  });
}

export async function updateCaseReminder(caseFileId: string, reminderId: string, input: NotificationInput, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const caseFile = await transaction.caseFile.findFirst({ where: { id: caseFileId, archivedAt: null }, select: { referenceNumber: true } });
    if (!caseFile) throw new CaseNotFoundError();
    const notifyAt = notificationTime(input.eventAt, input.priority);
    const result = await transaction.caseReminder.updateMany({
      where: { id: reminderId, caseFileId, status: "PENDING", deliveryPreparedAt: null },
      data: { title: input.title, description: input.description, reminderType: input.reminderType, priority: input.priority, eventAt: input.eventAt, dueAt: notifyAt, nextPreparationAt: notifyAt.getTime() > Date.now() ? notifyAt : new Date() },
    });
    if (result.count !== 1) throw new CaseReminderLockedError();
    const reminder = await transaction.caseReminder.findUniqueOrThrow({ where: { id: reminderId }, select: reminderSelect });
    await transaction.auditLog.create({ data: { actorUserId, event: "case.reminder_updated", targetType: "case_file", targetId: caseFileId, context: { referenceNumber: caseFile.referenceNumber, reminderId } } });
    return presentReminder(reminder);
  });
}

export async function deleteCaseReminder(caseFileId: string, reminderId: string, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const caseFile = await transaction.caseFile.findFirst({ where: { id: caseFileId, archivedAt: null }, select: { referenceNumber: true } });
    if (!caseFile) throw new CaseNotFoundError();
    const result = await transaction.caseReminder.updateMany({ where: { id: reminderId, caseFileId, status: { not: "CANCELLED" } }, data: { status: "CANCELLED" } });
    if (result.count !== 1) throw new CaseNotFoundError();
    await transaction.reminderDelivery.updateMany({ where: { reminderId, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "CANCELLED" } });
    await transaction.auditLog.create({ data: { actorUserId, event: "case.reminder_deleted", targetType: "case_file", targetId: caseFileId, context: { referenceNumber: caseFile.referenceNumber, reminderId } } });
  });
}

export class CaseReminderLockedError extends Error {}

const reminderSelect = { id: true, title: true, description: true, reminderType: true, priority: true, eventAt: true, dueAt: true, status: true, sentAt: true, createdBy: { select: { name: true } } } as const;
function presentReminder(reminder: { id: string; title: string; description: string | null; reminderType: string | null; priority: string; eventAt: Date; dueAt: Date; status: string; sentAt: Date | null; createdBy: { name: string } }) {
  return { ...reminder, priority: normalizePriority(reminder.priority), eventAt: reminder.eventAt.toISOString(), notifyAt: reminder.dueAt.toISOString(), dueAt: reminder.dueAt.toISOString(), sentAt: reminder.sentAt?.toISOString() ?? null, creator: reminder.createdBy };
}
function normalizePriority(value: string): "HIGH" | "MEDIUM" | "LOW" { return value === "HIGH" || value === "LOW" ? value : "MEDIUM"; }
