import { prisma } from "../database";

import type { z } from "zod";
import type { addCaseNoteSchema, addCaseReminderSchema } from "./create-case-input";
import { CaseNotFoundError } from "./update-case";

type NoteInput = z.infer<typeof addCaseNoteSchema>;
type ReminderInput = z.infer<typeof addCaseReminderSchema>;

export async function addCaseNote(caseFileId: string, input: NoteInput, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const caseFile = await transaction.caseFile.findFirst({
      where: { id: caseFileId, archivedAt: null },
      select: { id: true, referenceNumber: true },
    });
    if (!caseFile) throw new CaseNotFoundError();

    const note = await transaction.caseNote.create({
      data: { caseFileId, authorId: actorUserId, content: input.content.trim() },
      select: { id: true, createdAt: true },
    });
    await transaction.auditLog.create({
      data: { actorUserId, event: "case.note_added", targetType: "case_file", targetId: caseFileId, context: { referenceNumber: caseFile.referenceNumber } },
    });
    return { id: note.id, createdAt: note.createdAt.toISOString() };
  });
}

export async function addCaseReminder(caseFileId: string, input: ReminderInput, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const caseFile = await transaction.caseFile.findFirst({
      where: { id: caseFileId, archivedAt: null },
      select: { id: true, referenceNumber: true },
    });
    if (!caseFile) throw new CaseNotFoundError();

    const reminder = await transaction.caseReminder.create({
      data: {
        caseFileId,
        createdById: actorUserId,
        title: input.title,
        dueAt: input.dueAt,
        sendEmail: true,
        sendSms: false,
      },
      select: { id: true, dueAt: true, status: true },
    });
    await transaction.auditLog.create({
      data: {
        actorUserId,
        event: "case.reminder_added",
        targetType: "case_file",
        targetId: caseFileId,
        context: { referenceNumber: caseFile.referenceNumber, dueAt: reminder.dueAt.toISOString(), deliveryChannel: "email" },
      },
    });
    return { id: reminder.id, dueAt: reminder.dueAt.toISOString(), status: reminder.status };
  });
}
