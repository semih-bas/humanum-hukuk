import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../database";

export async function getCaseFile(id: string) {
  const record = await prisma.caseFile.findFirst({
    where: { id, archivedAt: null },
    select: {
      id: true,
      referenceNumber: true,
      licenseHolder: true,
      vehiclePlate: true,
      accidentDate: true,
      debtorType: true,
      debtorName: true,
      damageAmount: true,
      depreciationAmount: true,
      profitLossAmount: true,
      discountAmount: true,
      enforcementOffice: true,
      enforcementFileNumber: true,
      vehicleLien: true,
      bankLien: true,
      titleDeedLien: true,
      installmentCount: true,
      status: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, content: true, createdAt: true, updatedAt: true, author: { select: { name: true } } },
      },
      reminders: {
        orderBy: { dueAt: "asc" },
        select: { id: true, title: true, dueAt: true, sendEmail: true, sendSms: true, status: true, sentAt: true },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, originalName: true, mimeType: true, sizeBytes: true, sha256: true, createdAt: true },
      },
      changes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          changeType: true,
          previousVersion: true,
          newVersion: true,
          changedFields: true,
          createdAt: true,
          changedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!record) {
    return null;
  }

  const totalClaimAmount = record.damageAmount.add(record.depreciationAmount).add(record.profitLossAmount);
  const netClaimAmount = totalClaimAmount.sub(record.discountAmount);
  const monthlyInstallmentAmount = record.installmentCount
    ? centsToDecimal(BigInt(netClaimAmount.toFixed(2).replace(".", "")) / BigInt(record.installmentCount))
    : null;
  const finalInstallmentAmount = record.installmentCount
    ? netClaimAmount.sub(monthlyInstallmentAmount!.mul(record.installmentCount - 1))
    : null;

  return {
    ...record,
    accidentDate: record.accidentDate.toISOString().slice(0, 10),
    damageAmount: record.damageAmount.toFixed(2),
    depreciationAmount: record.depreciationAmount.toFixed(2),
    profitLossAmount: record.profitLossAmount.toFixed(2),
    discountAmount: record.discountAmount.toFixed(2),
    totalClaimAmount: totalClaimAmount.toFixed(2),
    netClaimAmount: netClaimAmount.toFixed(2),
    monthlyInstallmentAmount: monthlyInstallmentAmount?.toFixed(2) ?? null,
    finalInstallmentAmount: finalInstallmentAmount?.toFixed(2) ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    notes: record.notes.map((note) => ({
      ...note,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    reminders: record.reminders.map((reminder) => ({
      ...reminder,
      dueAt: reminder.dueAt.toISOString(),
      sentAt: reminder.sentAt?.toISOString() ?? null,
    })),
    documents: record.documents.map((document) => ({
      ...document,
      createdAt: document.createdAt.toISOString(),
    })),
    changes: record.changes.map((change) => ({
      ...change,
      createdAt: change.createdAt.toISOString(),
    })),
  };
}

export type CaseFileDetail = NonNullable<Awaited<ReturnType<typeof getCaseFile>>>;

function centsToDecimal(cents: bigint): Prisma.Decimal {
  return new Prisma.Decimal(`${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`);
}
