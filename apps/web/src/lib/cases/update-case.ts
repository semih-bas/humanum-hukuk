import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "../database";
import {
  calculateCaseFinancials,
  normalizeCaseCoreInput,
  parseDateOnly,
  type UpdateCaseInput,
} from "./create-case-input";

export class CaseNotFoundError extends Error {}
export class CaseVersionConflictError extends Error {}
export class CaseHasNoChangesError extends Error {}

type TransactionClient = Prisma.TransactionClient;

const editableFields = [
  "licenseHolder", "vehiclePlate", "accidentDate", "debtorType", "debtorName",
  "damageAmount", "depreciationAmount", "profitLossAmount", "discountAmount",
  "enforcementOffice", "enforcementFileNumber", "vehicleLien", "bankLien",
  "titleDeedLien", "installmentCount", "status",
] as const;

export async function updateCaseFile(id: string, rawInput: UpdateCaseInput, actorUserId: string) {
  return prisma.$transaction((transaction) => updateCaseFileInTransaction(transaction, id, rawInput, actorUserId));
}

export async function updateCaseFileInTransaction(
  transaction: TransactionClient,
  id: string,
  rawInput: UpdateCaseInput,
  actorUserId: string,
) {
  const input = normalizeCaseCoreInput(rawInput);
  const accidentDate = parseDateOnly(input.accidentDate);

  if (!accidentDate) {
    throw new Error("Validated accident date could not be parsed.");
  }

  const current = await transaction.caseFile.findFirst({ where: { id, archivedAt: null } });

  if (!current) {
    throw new CaseNotFoundError();
  }

  if (current.version !== input.version) {
    throw new CaseVersionConflictError();
  }

  const nextValues = {
    licenseHolder: input.licenseHolder,
    vehiclePlate: input.vehiclePlate,
    accidentDate,
    debtorType: input.debtorType,
    debtorName: input.debtorName,
    damageAmount: input.damageAmount,
    depreciationAmount: input.depreciationAmount,
    profitLossAmount: input.profitLossAmount,
    discountAmount: input.discountAmount,
    enforcementOffice: input.enforcementOffice,
    enforcementFileNumber: input.enforcementFileNumber,
    vehicleLien: input.vehicleLien,
    bankLien: input.bankLien,
    titleDeedLien: input.titleDeedLien,
    installmentCount: input.installmentCount,
    status: input.status,
  };
  const changedFields = editableFields.filter((field) => !sameValue(current[field], nextValues[field]));

  if (changedFields.length === 0) {
    throw new CaseHasNoChangesError();
  }

  const updateResult = await transaction.caseFile.updateMany({
    where: { id, version: input.version, archivedAt: null },
    data: { ...nextValues, updatedById: actorUserId, version: { increment: 1 } },
  });

  if (updateResult.count !== 1) {
    throw new CaseVersionConflictError();
  }

  const newVersion = input.version + 1;
  const financials = calculateCaseFinancials(input);
  const snapshot: Prisma.InputJsonObject = {
    referenceNumber: current.referenceNumber,
    licenseHolder: input.licenseHolder,
    vehiclePlate: input.vehiclePlate,
    accidentDate: input.accidentDate,
    debtorType: input.debtorType,
    debtorName: input.debtorName,
    damageAmount: input.damageAmount.toFixed(2),
    depreciationAmount: input.depreciationAmount.toFixed(2),
    profitLossAmount: input.profitLossAmount.toFixed(2),
    discountAmount: input.discountAmount.toFixed(2),
    totalClaimAmount: financials.totalClaimAmount.toFixed(2),
    netClaimAmount: financials.netClaimAmount.toFixed(2),
    monthlyInstallmentAmount: financials.monthlyInstallmentAmount?.toFixed(2) ?? null,
    finalInstallmentAmount: financials.finalInstallmentAmount?.toFixed(2) ?? null,
    enforcementOffice: input.enforcementOffice,
    enforcementFileNumber: input.enforcementFileNumber,
    vehicleLien: input.vehicleLien,
    bankLien: input.bankLien,
    titleDeedLien: input.titleDeedLien,
    installmentCount: input.installmentCount,
    status: input.status,
  };

  await transaction.caseFileChange.create({
    data: {
      caseFileId: id,
      changedById: actorUserId,
      changeType: changedFields.includes("status") ? "STATUS_CHANGED" : "UPDATED",
      previousVersion: input.version,
      newVersion,
      changedFields: [...changedFields],
      snapshot,
    },
  });

  await transaction.auditLog.create({
    data: {
      actorUserId,
      event: "case.updated",
      targetType: "case_file",
      targetId: id,
      context: { referenceNumber: current.referenceNumber, previousVersion: input.version, newVersion, changedFields: [...changedFields] },
    },
  });

  return { id, referenceNumber: current.referenceNumber, version: newVersion, changedFields: [...changedFields] };
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  if (isDecimalLike(left) && isDecimalLike(right)) return left.equals(right);
  return left === right;
}

function isDecimalLike(value: unknown): value is { equals(other: unknown): boolean } {
  return typeof value === "object" && value !== null && "equals" in value && typeof value.equals === "function";
}
