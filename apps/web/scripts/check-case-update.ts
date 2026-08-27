import { config } from "dotenv";

config({ path: [".env.local", ".env.docker"], quiet: true });

const { prisma } = await import("../src/lib/database");
const { updateCaseSchema } = await import("../src/lib/cases/create-case-input");
const {
  CaseHasNoChangesError,
  CaseVersionConflictError,
  updateCaseFileInTransaction,
} = await import("../src/lib/cases/update-case");

const referenceNumber = `TEST-UPDATE-${Date.now()}`;
const basePayload = {
  licenseHolder: "Test Ruhsat Sahibi",
  vehiclePlate: "34 TEST 002",
  accidentDate: "2026-01-15",
  debtorType: "INSURANCE_COMPANY",
  debtorName: "Test Sigorta A.Ş.",
  damageAmount: "1000.00",
  depreciationAmount: "500.00",
  profitLossAmount: "250.00",
  discountAmount: "250.00",
  enforcementOffice: "İstanbul 12. İcra Dairesi",
  enforcementFileNumber: `2026/${Date.now()}`,
  vehicleLien: false,
  bankLien: false,
  titleDeedLien: false,
  installmentCount: 6,
  status: "ENFORCEMENT",
  version: 1,
} as const;

try {
  const actor = await prisma.user.findFirst({ select: { id: true } });
  if (!actor) throw new Error("Case-update check requires at least one existing user.");

  const initial = updateCaseSchema.parse(basePayload);
  const updated = updateCaseSchema.parse({
    ...basePayload,
    licenseHolder: "Güncellenmiş Ruhsat Sahibi",
    status: "OPEN",
  });
  const rollbackMarker = "ROLLBACK_CASE_UPDATE_CHECK";
  let staleVersionRejected = false;
  let unchangedUpdateRejected = false;

  try {
    await prisma.$transaction(async (transaction) => {
      const caseFile = await transaction.caseFile.create({
        data: {
          referenceNumber,
          licenseHolder: initial.licenseHolder,
          vehiclePlate: initial.vehiclePlate,
          accidentDate: new Date(`${initial.accidentDate}T00:00:00.000Z`),
          debtorType: initial.debtorType,
          debtorName: initial.debtorName,
          damageAmount: initial.damageAmount,
          depreciationAmount: initial.depreciationAmount,
          profitLossAmount: initial.profitLossAmount,
          discountAmount: initial.discountAmount,
          enforcementOffice: initial.enforcementOffice,
          enforcementFileNumber: initial.enforcementFileNumber,
          vehicleLien: initial.vehicleLien,
          bankLien: initial.bankLien,
          titleDeedLien: initial.titleDeedLien,
          installmentCount: initial.installmentCount,
          status: initial.status,
          createdById: actor.id,
          updatedById: actor.id,
        },
      });

      await transaction.caseFileChange.create({
        data: {
          caseFileId: caseFile.id,
          changedById: actor.id,
          changeType: "CREATED",
          newVersion: 1,
          changedFields: [],
          snapshot: { referenceNumber },
        },
      });

      const result = await updateCaseFileInTransaction(transaction, caseFile.id, updated, actor.id);
      if (result.version !== 2 || !result.changedFields.includes("licenseHolder") || !result.changedFields.includes("status") || result.changedFields.includes("installmentCount")) {
        throw new Error("Case update did not report the expected version and changed fields.");
      }

      const stored = await transaction.caseFile.findUnique({
        where: { id: caseFile.id },
        include: { changes: { orderBy: { createdAt: "asc" } } },
      });
      const audit = await transaction.auditLog.findFirst({ where: { event: "case.updated", targetId: caseFile.id } });
      if (
        !stored
        || stored.version !== 2
        || stored.status !== "OPEN"
        || stored.installmentCount !== 6
        || stored.changes.length !== 2
        || stored.changes[1].changeType !== "STATUS_CHANGED"
        || stored.changes[1].previousVersion !== 1
        || stored.changes[1].newVersion !== 2
        || !audit
      ) {
        throw new Error("Case update did not atomically persist its history and audit records.");
      }

      try {
        await updateCaseFileInTransaction(transaction, caseFile.id, updated, actor.id);
      } catch (error) {
        staleVersionRejected = error instanceof CaseVersionConflictError;
      }

      const sameVersionTwo = updateCaseSchema.parse({ ...basePayload, licenseHolder: updated.licenseHolder, status: updated.status, version: 2 });
      try {
        await updateCaseFileInTransaction(transaction, caseFile.id, sameVersionTwo, actor.id);
      } catch (error) {
        unchangedUpdateRejected = error instanceof CaseHasNoChangesError;
      }

      if (!staleVersionRejected || !unchangedUpdateRejected) {
        throw new Error("Case update concurrency or no-change protection did not reject the request.");
      }

      throw new Error(rollbackMarker);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== rollbackMarker) throw error;
  }

  if (await prisma.caseFile.count({ where: { referenceNumber } }) !== 0) {
    throw new Error("Temporary case-update test record was not rolled back.");
  }

  console.log({
    status: "case-update-valid",
    versionIncremented: true,
    historyAndAuditAtomic: true,
    staleVersionRejected,
    unchangedUpdateRejected,
    temporaryRecordsPersisted: false,
  });
} finally {
  await prisma.$disconnect();
}
