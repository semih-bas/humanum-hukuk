import "server-only";

import { prisma } from "@/lib/database";
import { generalCaseAccessWhere, type GeneralCaseActor } from "@/lib/general-legal-cases/access";
import { DELETION_RETENTION_DAYS, deletionDueAt } from "@/lib/deletion-policy";

export { DELETION_RETENTION_DAYS };
export class RecoverableRecordNotFoundError extends Error {}

export async function archiveEnforcementCase(id: string, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const record = await transaction.caseFile.findFirst({ where: { id, archivedAt: null }, select: { referenceNumber: true } });
    if (!record) throw new RecoverableRecordNotFoundError();
    const archivedAt = new Date(); const purgeAfter = deletionDueAt(archivedAt);
    await transaction.caseFile.update({ where: { id }, data: { archivedAt, archivedById: actorUserId, purgeAfter } });
    await transaction.auditLog.create({ data: { actorUserId, event: "case_file.deletion_scheduled", targetType: "case_file", targetId: id, context: { referenceNumber: record.referenceNumber, purgeAfter: purgeAfter.toISOString() } } });
    return { id, purgeAfter };
  });
}

export async function archiveInsuranceCase(id: string, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const record = await transaction.insuranceArbitrationCase.findFirst({ where: { id, archivedAt: null }, select: { referenceNumber: true } });
    if (!record) throw new RecoverableRecordNotFoundError();
    const archivedAt = new Date(); const purgeAfter = deletionDueAt(archivedAt);
    await transaction.insuranceArbitrationCase.update({ where: { id }, data: { archivedAt, archivedById: actorUserId, purgeAfter } });
    await transaction.auditLog.create({ data: { actorUserId, event: "insurance_arbitration_case.deletion_scheduled", targetType: "insurance_arbitration_case", targetId: id, context: { referenceNumber: record.referenceNumber, purgeAfter: purgeAfter.toISOString() } } });
    return { id, purgeAfter };
  });
}

export async function archiveGeneralCase(id: string, actor: GeneralCaseActor) {
  return prisma.$transaction(async (transaction) => {
    const record = await transaction.generalLegalCase.findFirst({ where: { id, archivedAt: null, ...generalCaseAccessWhere(actor) }, select: { referenceNumber: true } });
    if (!record) throw new RecoverableRecordNotFoundError();
    const archivedAt = new Date(); const purgeAfter = deletionDueAt(archivedAt);
    await transaction.generalLegalCase.update({ where: { id }, data: { archivedAt, archivedById: actor.id, purgeAfter } });
    await transaction.auditLog.create({ data: { actorUserId: actor.id, event: "general_legal_case.deletion_scheduled", targetType: "general_legal_case", targetId: id, context: { referenceNumber: record.referenceNumber, purgeAfter: purgeAfter.toISOString() } } });
    return { id, purgeAfter };
  });
}

export function deletionResponse(result: { id: string; purgeAfter: Date }) { return { id: result.id, retentionDays: DELETION_RETENTION_DAYS, purgeAfter: result.purgeAfter.toISOString() }; }
