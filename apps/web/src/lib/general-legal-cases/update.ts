import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database";
import { notificationTime } from "@/lib/notification-schedule";

import { canRetainRestrictedAccess, generalCaseAccessWhere, type GeneralCaseActor } from "./access";
import { calculateGeneralCaseFinanceTotals } from "./finance-calculations";
import type { GeneralCasePartyInput, UpdateGeneralLegalCaseInput } from "./input";
import { parseDateOnly } from "./input";
import { getGeneralLegalCase, GeneralLegalCaseNotFoundError } from "./read";
import { assertActiveGeneralCaseUserReferences } from "./user-references";

export class GeneralLegalCaseVersionConflictError extends Error {}
export class GeneralLegalCaseRestrictedAccessError extends Error {}

export async function updateGeneralLegalCase(id: string, input: UpdateGeneralLegalCaseInput, actor: GeneralCaseActor) {
  await assertActiveGeneralCaseUserReferences(input);
  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.generalLegalCase.findFirst({
      where: { id, archivedAt: null, ...generalCaseAccessWhere(actor) },
      select: { id: true, referenceNumber: true, version: true, createdById: true },
    });
    if (!existing) throw new GeneralLegalCaseNotFoundError();
    if (existing.version !== input.version) throw new GeneralLegalCaseVersionConflictError();
    if (!canRetainRestrictedAccess(actor, existing.createdById, input)) throw new GeneralLegalCaseRestrictedAccessError();

    const { parties, finance, financialEntries, processEntries, hearings, tasks, notes, version } = input;
    const totals = finance ? calculateGeneralCaseFinanceTotals(
      decimalToCents(finance.expectedCollectionAmount),
      financialEntries.map((entry) => ({ type: entry.type, amountCents: decimalToCents(entry.amount) })),
    ) : null;
    const caseInput = {
      kind: input.kind, caseType: input.caseType, subject: input.subject, caseValue: input.caseValue,
      uyapMainNumber: input.uyapMainNumber, uyapDecisionNumber: input.uyapDecisionNumber,
      courthouse: input.courthouse, courtType: input.courtType, court: input.court,
      status: input.status, stage: input.stage, procedure: input.procedure, urgent: input.urgent,
      confidentiality: input.confidentiality, trackingGroup: input.trackingGroup, tags: input.tags,
      office: input.office, description: input.description, documentFolders: input.documentFolders, responsibleUserId: input.responsibleUserId,
      fileStaffUserId: input.fileStaffUserId,
    };
    const updated = await transaction.generalLegalCase.updateMany({
      where: { id, version, archivedAt: null },
      data: {
        ...caseInput,
        openingDate: parseDateOnly(input.openingDate)!,
        estimatedCompletionDate: parseDateOnly(input.estimatedCompletionDate),
        ...(finance ? {
          claimAmount: finance.claimAmount, amendmentAmount: finance.amendmentAmount,
          interestRequested: finance.interestRequested, interestStartDate: parseDateOnly(finance.interestStartDate),
          expectedCollectionAmount: finance.expectedCollectionAmount, opposingAttorneyFee: finance.opposingAttorneyFee,
          collectionStatus: collectionStatus(decimalToCents(finance.expectedCollectionAmount), totals!.collectionCents),
          paymentPlan: finance.paymentPlan, installmentCount: finance.installmentCount, financeDescription: finance.financeDescription,
        } : {}),
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new GeneralLegalCaseVersionConflictError();

    await transaction.generalCaseParty.deleteMany({ where: { caseId: id } });
    await transaction.generalCaseParty.createMany({ data: partyCreateData(parties).map((party) => ({ ...party, caseId: id })) });
    const deletedAt = new Date();
    await transaction.generalCaseFinancialEntry.updateMany({ where: { caseId: id, deletedAt: null }, data: { deletedAt, deletedById: actor.id, updatedById: actor.id, version: { increment: 1 } } });
    if (financialEntries.length) await transaction.generalCaseFinancialEntry.createMany({ data: financialEntries.map((entry) => ({ caseId: id, type: entry.type, category: entry.category, entryDate: parseDateOnly(entry.entryDate)!, amount: entry.amount, description: entry.description, createdById: actor.id, updatedById: actor.id })) });
    await transaction.generalCaseProcessEntry.updateMany({ where: { caseId: id, deletedAt: null }, data: { deletedAt, deletedById: actor.id, updatedById: actor.id, version: { increment: 1 } } });
    if (processEntries.length) await transaction.generalCaseProcessEntry.createMany({ data: processEntries.map((entry) => ({ caseId: id, type: entry.type, stage: entry.stage, eventDate: parseDateOnly(entry.eventDate)!, action: entry.action, description: entry.description, responsibleUserId: entry.responsibleUserId, createdById: actor.id, updatedById: actor.id })) });
    await transaction.generalCaseHearing.updateMany({ where: { caseId: id, deletedAt: null }, data: { deletedAt, deletedById: actor.id, updatedById: actor.id, version: { increment: 1 } } });
    if (hearings.length) await transaction.generalCaseHearing.createMany({ data: hearings.map((hearing) => ({ ...hearing, caseId: id, createdById: actor.id, updatedById: actor.id })) });
    await transaction.generalCaseTask.updateMany({ where: { caseId: id, deletedAt: null }, data: { deletedAt, deletedById: actor.id, updatedById: actor.id, version: { increment: 1 } } });
    if (tasks.length) await transaction.generalCaseTask.createMany({ data: tasks.map((task) => ({ ...task, notifyAt: notificationTime(task.dueAt, task.priority), status: "PENDING", caseId: id, createdById: actor.id, updatedById: actor.id })) });
    await transaction.generalCaseNote.updateMany({ where: { caseId: id, deletedAt: null, OR: [{ visibility: "TEAM" }, { authorId: actor.id }] }, data: { deletedAt, deletedById: actor.id } });
    if (notes.length) await transaction.generalCaseNote.createMany({ data: notes.map((note) => ({ ...note, caseId: id, authorId: actor.id })) });
    await transaction.auditLog.create({
      data: {
        actorUserId: actor.id,
        event: "general_legal_case.updated",
        targetType: "general_legal_case",
        targetId: id,
        context: { referenceNumber: existing.referenceNumber, previousVersion: version, newVersion: version + 1, kind: input.kind, confidentiality: input.confidentiality, financialEntryCount: financialEntries.length, processEntryCount: processEntries.length, hearingCount: hearings.length, taskCount: tasks.length, noteCount: notes.length },
      },
    });
  });
  return getGeneralLegalCase(id, actor);
}

function partyCreateData(parties: GeneralCasePartyInput[]) {
  return parties.map((party, index) => ({ ...party, sortOrder: index }));
}

function decimalToCents(value: Prisma.Decimal) { return BigInt(value.toFixed(2).replace(".", "")); }
function collectionStatus(expectedCents: bigint, collectedCents: bigint) {
  if (collectedCents <= 0n) return "NOT_COLLECTED" as const;
  if (expectedCents <= 0n || collectedCents >= expectedCents) return "COLLECTED" as const;
  return "PARTIAL" as const;
}
