import { prisma } from "@/lib/database";

import { canRetainRestrictedAccess, generalCaseAccessWhere, type GeneralCaseActor } from "./access";
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

    const { parties, version } = input;
    const caseInput = {
      kind: input.kind, caseType: input.caseType, subject: input.subject, caseValue: input.caseValue,
      uyapMainNumber: input.uyapMainNumber, uyapDecisionNumber: input.uyapDecisionNumber,
      courthouse: input.courthouse, courtType: input.courtType, court: input.court,
      status: input.status, stage: input.stage, procedure: input.procedure, urgent: input.urgent,
      confidentiality: input.confidentiality, trackingGroup: input.trackingGroup, tags: input.tags,
      office: input.office, description: input.description, responsibleUserId: input.responsibleUserId,
      fileStaffUserId: input.fileStaffUserId,
    };
    const updated = await transaction.generalLegalCase.updateMany({
      where: { id, version, archivedAt: null },
      data: {
        ...caseInput,
        openingDate: parseDateOnly(input.openingDate)!,
        estimatedCompletionDate: parseDateOnly(input.estimatedCompletionDate),
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new GeneralLegalCaseVersionConflictError();

    await transaction.generalCaseParty.deleteMany({ where: { caseId: id } });
    await transaction.generalCaseParty.createMany({ data: partyCreateData(parties).map((party) => ({ ...party, caseId: id })) });
    await transaction.auditLog.create({
      data: {
        actorUserId: actor.id,
        event: "general_legal_case.updated",
        targetType: "general_legal_case",
        targetId: id,
        context: { referenceNumber: existing.referenceNumber, previousVersion: version, newVersion: version + 1, kind: input.kind, confidentiality: input.confidentiality },
      },
    });
  });
  return getGeneralLegalCase(id, actor);
}

function partyCreateData(parties: GeneralCasePartyInput[]) {
  return parties.map((party, index) => ({ ...party, sortOrder: index }));
}
