import { prisma } from "@/lib/database";
import type { NotificationInput } from "@/lib/notification-input";
import { notificationLeadMinutes, notificationTime } from "@/lib/notification-schedule";
import type { CreateGeneralCaseNoteInput } from "./note-input";
import { getGeneralLegalCase, GeneralLegalCaseNotFoundError } from "./read";
import type { GeneralCaseActor } from "./access";

export class GeneralCaseTaskLockedError extends Error {}

const taskSelect = { id: true, title: true, description: true, taskType: true, priority: true, dueAt: true, notifyAt: true, status: true, sentAt: true, createdBy: { select: { name: true } } } as const;

export async function addGeneralCaseTask(caseId: string, input: NotificationInput, actor: GeneralCaseActor) {
  await getGeneralLegalCase(caseId, actor);
  const task = await prisma.generalCaseTask.create({ data: {
    caseId, createdById: actor.id, updatedById: actor.id, assigneeUserId: actor.id,
    title: input.title, description: input.description, taskType: input.reminderType,
    priority: input.priority, dueAt: input.eventAt, notifyAt: notificationTime(input.eventAt, input.priority),
    reminderOffsetMinutes: notificationLeadMinutes(input.priority), status: "PENDING",
  }, select: taskSelect });
  await audit(actor.id, "general_legal_case.notification_added", caseId, { taskId: task.id });
  return presentTask(task);
}

export async function updateGeneralCaseTask(caseId: string, taskId: string, input: NotificationInput, actor: GeneralCaseActor) {
  await getGeneralLegalCase(caseId, actor);
  const result = await prisma.generalCaseTask.updateMany({ where: { id: taskId, caseId, deletedAt: null, status: { in: ["PENDING", "PLANNED"] }, deliveryPreparedAt: null }, data: {
    title: input.title, description: input.description, taskType: input.reminderType, priority: input.priority,
    dueAt: input.eventAt, notifyAt: notificationTime(input.eventAt, input.priority), reminderOffsetMinutes: notificationLeadMinutes(input.priority),
    nextPreparationAt: new Date(), updatedById: actor.id, version: { increment: 1 },
  } });
  if (!result.count) throw new GeneralCaseTaskLockedError();
  const task = await prisma.generalCaseTask.findUniqueOrThrow({ where: { id: taskId }, select: taskSelect });
  await audit(actor.id, "general_legal_case.notification_updated", caseId, { taskId });
  return presentTask(task);
}

export async function deleteGeneralCaseTask(caseId: string, taskId: string, actor: GeneralCaseActor) {
  await getGeneralLegalCase(caseId, actor);
  const result = await prisma.generalCaseTask.updateMany({ where: { id: taskId, caseId, deletedAt: null }, data: { deletedAt: new Date(), deletedById: actor.id, updatedById: actor.id, status: "CANCELLED", version: { increment: 1 } } });
  if (!result.count) throw new GeneralLegalCaseNotFoundError();
  await audit(actor.id, "general_legal_case.notification_deleted", caseId, { taskId });
}

export async function addGeneralCaseNote(caseId: string, input: CreateGeneralCaseNoteInput, actor: GeneralCaseActor) {
  await getGeneralLegalCase(caseId, actor);
  const note = await prisma.generalCaseNote.create({ data: { caseId, authorId: actor.id, ...input }, select: { id: true, content: true, noteType: true, visibility: true, important: true } });
  await audit(actor.id, "general_legal_case.note_added", caseId, { noteId: note.id });
  return note;
}

export async function deleteGeneralCaseNote(caseId: string, noteId: string, actor: GeneralCaseActor) {
  await getGeneralLegalCase(caseId, actor);
  const result = await prisma.generalCaseNote.updateMany({ where: { id: noteId, caseId, deletedAt: null, OR: [{ visibility: "TEAM" }, { authorId: actor.id }] }, data: { deletedAt: new Date(), deletedById: actor.id } });
  if (!result.count) throw new GeneralLegalCaseNotFoundError();
  await audit(actor.id, "general_legal_case.note_deleted", caseId, { noteId });
}

function presentTask(task: { id: string; title: string; description: string | null; taskType: string | null; priority: string; dueAt: Date; notifyAt: Date | null; status: string; sentAt: Date | null; createdBy: { name: string } }) {
  return { id: task.id, title: task.title, description: task.description, reminderType: task.taskType, priority: normalizeNotificationPriority(task.priority), eventAt: task.dueAt.toISOString(), notifyAt: (task.notifyAt ?? task.dueAt).toISOString(), status: task.status, sentAt: task.sentAt?.toISOString() ?? null, creator: task.createdBy };
}
function normalizeNotificationPriority(value: string): "HIGH" | "MEDIUM" | "LOW" { return value === "HIGH" || value === "LOW" ? value : "MEDIUM"; }

function audit(actorUserId: string, event: string, targetId: string, context: object) { return prisma.auditLog.create({ data: { actorUserId, event, targetType: "general_legal_case", targetId, context } }); }
