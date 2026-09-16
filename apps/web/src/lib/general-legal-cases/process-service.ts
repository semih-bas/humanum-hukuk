import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database";

import { generalCaseAccessWhere, type GeneralCaseActor } from "./access";
import type { CreateGeneralCaseHearingInput, CreateGeneralCaseProcessEntryInput, UpdateGeneralCaseHearingInput, UpdateGeneralCaseProcessEntryInput } from "./process-input";
import { parseDateOnly } from "./input";
import { GeneralLegalCaseNotFoundError } from "./read";
import { assertActiveGeneralCaseUserReference } from "./user-references";

export class GeneralCaseProcessRecordNotFoundError extends Error {}
export class GeneralCaseProcessVersionConflictError extends Error {}

const processSelect = {
  id: true, referenceNumber: true, stage: true, status: true, version: true,
  processEntries: {
    where: { deletedAt: null }, orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, type: true, stage: true, eventDate: true, action: true, description: true, version: true, createdAt: true, updatedAt: true, responsibleUser: { select: { id: true, name: true } } },
  },
  hearings: {
    where: { deletedAt: null }, orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, startsAt: true, court: true, hearingType: true, courtroom: true, reminderOffsetMinutes: true, note: true, status: true, version: true, createdAt: true, updatedAt: true, attendeeUser: { select: { id: true, name: true } } },
  },
} satisfies Prisma.GeneralLegalCaseSelect;

type ProcessRecord = Prisma.GeneralLegalCaseGetPayload<{ select: typeof processSelect }>;

export async function getGeneralCaseProcess(caseId: string, actor: GeneralCaseActor) {
  const record = await prisma.generalLegalCase.findFirst({ where: accessibleWhere(caseId, actor), select: processSelect });
  if (!record) throw new GeneralLegalCaseNotFoundError();
  return present(record);
}

export async function createGeneralCaseProcessEntry(caseId: string, input: CreateGeneralCaseProcessEntryInput, actor: GeneralCaseActor) {
  await assertActiveGeneralCaseUserReference(input.responsibleUserId);
  const id = await prisma.$transaction(async (transaction) => {
    const legalCase = await requireAccessibleCase(transaction, caseId, actor);
    const created = await transaction.generalCaseProcessEntry.create({ data: {
      caseId, type: input.type, stage: input.stage, eventDate: parseDateOnly(input.eventDate)!, action: input.action,
      description: input.description, responsibleUserId: input.responsibleUserId, createdById: actor.id, updatedById: actor.id,
    }, select: { id: true } });
    await touchCase(transaction, caseId, actor.id, input.type === "STAGE_CHANGE" ? input.stage : null);
    await audit(transaction, actor.id, "general_legal_case.process_entry_created", "general_case_process_entry", created.id, { caseId, referenceNumber: legalCase.referenceNumber, stage: input.stage, type: input.type });
    return created.id;
  });
  return { ...await getGeneralCaseProcess(caseId, actor), createdEntryId: id };
}

export async function updateGeneralCaseProcessEntry(caseId: string, entryId: string, input: UpdateGeneralCaseProcessEntryInput, actor: GeneralCaseActor) {
  await assertActiveGeneralCaseUserReference(input.responsibleUserId);
  await prisma.$transaction(async (transaction) => {
    const legalCase = await requireAccessibleCase(transaction, caseId, actor);
    const result = await transaction.generalCaseProcessEntry.updateMany({ where: { id: entryId, caseId, deletedAt: null, version: input.version }, data: {
      type: input.type, stage: input.stage, eventDate: parseDateOnly(input.eventDate)!, action: input.action, description: input.description,
      responsibleUserId: input.responsibleUserId, updatedById: actor.id, version: { increment: 1 },
    } });
    await ensureUpdatedRecord(transaction, "entry", entryId, caseId, result.count);
    await touchCase(transaction, caseId, actor.id, input.type === "STAGE_CHANGE" ? input.stage : null);
    await audit(transaction, actor.id, "general_legal_case.process_entry_updated", "general_case_process_entry", entryId, { caseId, referenceNumber: legalCase.referenceNumber, previousVersion: input.version });
  });
  return getGeneralCaseProcess(caseId, actor);
}

export async function deleteGeneralCaseProcessEntry(caseId: string, entryId: string, actor: GeneralCaseActor) {
  await softDelete(caseId, entryId, "entry", actor);
  return { id: entryId };
}

export async function createGeneralCaseHearing(caseId: string, input: CreateGeneralCaseHearingInput, actor: GeneralCaseActor) {
  await assertActiveGeneralCaseUserReference(input.attendeeUserId);
  const id = await prisma.$transaction(async (transaction) => {
    const legalCase = await requireAccessibleCase(transaction, caseId, actor);
    const created = await transaction.generalCaseHearing.create({ data: { ...input, caseId, createdById: actor.id, updatedById: actor.id }, select: { id: true } });
    await touchCase(transaction, caseId, actor.id, null);
    await audit(transaction, actor.id, "general_legal_case.hearing_created", "general_case_hearing", created.id, { caseId, referenceNumber: legalCase.referenceNumber, startsAt: input.startsAt.toISOString() });
    return created.id;
  });
  return { ...await getGeneralCaseProcess(caseId, actor), createdHearingId: id };
}

export async function updateGeneralCaseHearing(caseId: string, hearingId: string, input: UpdateGeneralCaseHearingInput, actor: GeneralCaseActor) {
  await assertActiveGeneralCaseUserReference(input.attendeeUserId);
  await prisma.$transaction(async (transaction) => {
    const legalCase = await requireAccessibleCase(transaction, caseId, actor);
    const { version, ...data } = input;
    const result = await transaction.generalCaseHearing.updateMany({ where: { id: hearingId, caseId, deletedAt: null, version }, data: { ...data, updatedById: actor.id, version: { increment: 1 } } });
    await ensureUpdatedRecord(transaction, "hearing", hearingId, caseId, result.count);
    await touchCase(transaction, caseId, actor.id, null);
    await audit(transaction, actor.id, "general_legal_case.hearing_updated", "general_case_hearing", hearingId, { caseId, referenceNumber: legalCase.referenceNumber, previousVersion: version });
  });
  return getGeneralCaseProcess(caseId, actor);
}

export async function deleteGeneralCaseHearing(caseId: string, hearingId: string, actor: GeneralCaseActor) {
  await softDelete(caseId, hearingId, "hearing", actor);
  return { id: hearingId };
}

async function softDelete(caseId: string, recordId: string, kind: "entry" | "hearing", actor: GeneralCaseActor) {
  await prisma.$transaction(async (transaction) => {
    const legalCase = await requireAccessibleCase(transaction, caseId, actor);
    const data = { deletedAt: new Date(), deletedById: actor.id, updatedById: actor.id, version: { increment: 1 } };
    const result = kind === "entry"
      ? await transaction.generalCaseProcessEntry.updateMany({ where: { id: recordId, caseId, deletedAt: null }, data })
      : await transaction.generalCaseHearing.updateMany({ where: { id: recordId, caseId, deletedAt: null }, data });
    if (result.count !== 1) throw new GeneralCaseProcessRecordNotFoundError();
    await touchCase(transaction, caseId, actor.id, null);
    await audit(transaction, actor.id, `general_legal_case.${kind}_deleted`, kind === "entry" ? "general_case_process_entry" : "general_case_hearing", recordId, { caseId, referenceNumber: legalCase.referenceNumber });
  });
}

function accessibleWhere(caseId: string, actor: GeneralCaseActor) { return { id: caseId, archivedAt: null, ...generalCaseAccessWhere(actor) }; }
async function requireAccessibleCase(transaction: Prisma.TransactionClient, caseId: string, actor: GeneralCaseActor) {
  const record = await transaction.generalLegalCase.findFirst({ where: accessibleWhere(caseId, actor), select: { id: true, referenceNumber: true } });
  if (!record) throw new GeneralLegalCaseNotFoundError();
  return record;
}
async function touchCase(transaction: Prisma.TransactionClient, caseId: string, actorId: string, stage: Prisma.GeneralLegalCaseUpdateInput["stage"] | null) {
  await transaction.generalLegalCase.update({ where: { id: caseId }, data: { ...(stage ? { stage, status: statusForStage(String(stage)) } : {}), updatedById: actorId, version: { increment: 1 } } });
}
function statusForStage(stage: string) { if (stage === "CLOSED") return "CLOSED" as const; if (stage === "DECISION") return "DECISION" as const; if (stage === "APPEAL" || stage === "CASSATION") return "APPEAL" as const; return "ACTIVE" as const; }
async function ensureUpdatedRecord(transaction: Prisma.TransactionClient, kind: "entry" | "hearing", id: string, caseId: string, count: number) {
  if (count === 1) return;
  const found = kind === "entry" ? await transaction.generalCaseProcessEntry.count({ where: { id, caseId, deletedAt: null } }) : await transaction.generalCaseHearing.count({ where: { id, caseId, deletedAt: null } });
  if (!found) throw new GeneralCaseProcessRecordNotFoundError();
  throw new GeneralCaseProcessVersionConflictError();
}
async function audit(transaction: Prisma.TransactionClient, actorUserId: string, event: string, targetType: string, targetId: string, context: Prisma.InputJsonValue) { await transaction.auditLog.create({ data: { actorUserId, event, targetType, targetId, context } }); }
function present(record: ProcessRecord) { return { ...record, processEntries: record.processEntries.map((item) => ({ ...item, eventDate: item.eventDate.toISOString().slice(0, 10), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })), hearings: record.hearings.map((item) => ({ ...item, startsAt: item.startsAt.toISOString(), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })) }; }
