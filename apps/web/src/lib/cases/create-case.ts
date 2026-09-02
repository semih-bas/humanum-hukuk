import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "../database";
import { checkReminderCreationLimit, lockReminderCreation } from "./reminder-creation-limit";
import {
  calculateCaseFinancials,
  type CreateCaseInput,
  normalizeCreateCaseInput,
  parseDateOnly,
} from "./create-case-input";

type TransactionClient = Prisma.TransactionClient;

export type CreatedCase = {
  id: string;
  referenceNumber: string;
  version: number;
  createdAt: string;
  financials: {
    totalClaimAmount: string;
    netClaimAmount: string;
    monthlyInstallmentAmount: string | null;
    finalInstallmentAmount: string | null;
  };
};

export async function createCaseFile(input: CreateCaseInput, actorUserId: string): Promise<CreatedCase> {
  return prisma.$transaction((transaction) => createCaseFileInTransaction(transaction, input, actorUserId));
}

export async function createCaseFileInTransaction(
  transaction: TransactionClient,
  rawInput: CreateCaseInput,
  actorUserId: string,
): Promise<CreatedCase> {
  const input = normalizeCreateCaseInput(rawInput);
  if (input.reminder) {
    await lockReminderCreation(transaction, actorUserId);
    await checkReminderCreationLimit(transaction, actorUserId);
  }
  const financials = calculateCaseFinancials(input);
  const accidentDate = parseDateOnly(input.accidentDate);

  if (!accidentDate) {
    throw new Error("Validated accident date could not be parsed.");
  }

  const [sequence] = await transaction.$queryRaw<Array<{ value: bigint }>>`
    SELECT nextval('case_file_reference_sequence') AS value
  `;

  if (!sequence) {
    throw new Error("Case reference sequence did not return a value.");
  }

  const referenceNumber = `HH-${currentIstanbulYear()}-${sequence.value.toString().padStart(6, "0")}`;
  const snapshot = buildSnapshot(input, referenceNumber, financials);

  const caseFile = await transaction.caseFile.create({
    data: {
      referenceNumber,
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
      createdById: actorUserId,
      updatedById: actorUserId,
      changes: {
        create: {
          changedById: actorUserId,
          changeType: "CREATED",
          newVersion: 1,
          changedFields: Object.keys(snapshot),
          snapshot,
        },
      },
      notes: input.note ? {
        create: {
          authorId: actorUserId,
          content: input.note,
        },
      } : undefined,
      reminders: input.reminder ? {
        create: {
          createdById: actorUserId,
          title: input.reminder.title,
          dueAt: input.reminder.dueAt,
          sendEmail: true,
          sendSms: false,
        },
      } : undefined,
    },
    select: {
      id: true,
      referenceNumber: true,
      version: true,
      createdAt: true,
    },
  });

  await transaction.auditLog.create({
    data: {
      actorUserId,
      event: "case.created",
      targetType: "case_file",
      targetId: caseFile.id,
      context: {
        referenceNumber: caseFile.referenceNumber,
        status: input.status,
      },
    },
  });

  return {
    id: caseFile.id,
    referenceNumber: caseFile.referenceNumber,
    version: caseFile.version,
    createdAt: caseFile.createdAt.toISOString(),
    financials: {
      totalClaimAmount: financials.totalClaimAmount.toFixed(2),
      netClaimAmount: financials.netClaimAmount.toFixed(2),
      monthlyInstallmentAmount: financials.monthlyInstallmentAmount?.toFixed(2) ?? null,
      finalInstallmentAmount: financials.finalInstallmentAmount?.toFixed(2) ?? null,
    },
  };
}

function currentIstanbulYear(): string {
  return new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
  }).format(new Date());
}

function buildSnapshot(
  input: CreateCaseInput,
  referenceNumber: string,
  financials: ReturnType<typeof calculateCaseFinancials>,
): Prisma.InputJsonObject {
  return {
    referenceNumber,
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
    hasNote: Boolean(input.note),
    hasReminder: Boolean(input.reminder),
  };
}
