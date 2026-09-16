import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database";

import { generalCaseAccessWhere, type GeneralCaseActor } from "./access";
import { calculateGeneralCaseFinanceTotals } from "./finance-calculations";
import type {
  CreateGeneralCaseFinancialEntryInput,
  GeneralCaseFinanceSummaryInput,
  UpdateGeneralCaseFinancialEntryInput,
} from "./finance-input";
import { parseDateOnly } from "./input";
import { GeneralLegalCaseNotFoundError } from "./read";

export class GeneralCaseFinancialEntryNotFoundError extends Error {}
export class GeneralCaseFinanceVersionConflictError extends Error {}

const financeSelect = {
  id: true,
  referenceNumber: true,
  version: true,
  claimAmount: true,
  amendmentAmount: true,
  interestRequested: true,
  interestStartDate: true,
  expectedCollectionAmount: true,
  opposingAttorneyFee: true,
  collectionStatus: true,
  paymentPlan: true,
  installmentCount: true,
  financeDescription: true,
  financialEntries: {
    where: { deletedAt: null },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      category: true,
      entryDate: true,
      amount: true,
      description: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.GeneralLegalCaseSelect;

type FinanceRecord = Prisma.GeneralLegalCaseGetPayload<{ select: typeof financeSelect }>;

export async function getGeneralCaseFinance(caseId: string, actor: GeneralCaseActor) {
  const record = await prisma.generalLegalCase.findFirst({
    where: { id: caseId, archivedAt: null, ...generalCaseAccessWhere(actor) },
    select: financeSelect,
  });
  if (!record) throw new GeneralLegalCaseNotFoundError();
  return presentFinance(record);
}

export async function updateGeneralCaseFinance(caseId: string, input: GeneralCaseFinanceSummaryInput, actor: GeneralCaseActor) {
  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.generalLegalCase.findFirst({
      where: { id: caseId, archivedAt: null, ...generalCaseAccessWhere(actor) },
      select: { id: true, referenceNumber: true, version: true },
    });
    if (!existing) throw new GeneralLegalCaseNotFoundError();
    if (existing.version !== input.version) throw new GeneralCaseFinanceVersionConflictError();

    const collected = await sumCollections(transaction, caseId);
    const result = await transaction.generalLegalCase.updateMany({
      where: { id: caseId, version: input.version, archivedAt: null },
      data: {
        claimAmount: input.claimAmount,
        amendmentAmount: input.amendmentAmount,
        interestRequested: input.interestRequested,
        interestStartDate: parseDateOnly(input.interestStartDate),
        expectedCollectionAmount: input.expectedCollectionAmount,
        opposingAttorneyFee: input.opposingAttorneyFee,
        collectionStatus: collectionStatus(input.expectedCollectionAmount, collected),
        paymentPlan: input.paymentPlan,
        installmentCount: input.installmentCount,
        financeDescription: input.financeDescription,
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new GeneralCaseFinanceVersionConflictError();

    await transaction.auditLog.create({
      data: {
        actorUserId: actor.id,
        event: "general_legal_case.finance_updated",
        targetType: "general_legal_case",
        targetId: caseId,
        context: { referenceNumber: existing.referenceNumber, previousVersion: input.version, newVersion: input.version + 1 },
      },
    });
  });
  return getGeneralCaseFinance(caseId, actor);
}

export async function createGeneralCaseFinancialEntry(caseId: string, input: CreateGeneralCaseFinancialEntryInput, actor: GeneralCaseActor) {
  const entryId = await prisma.$transaction(async (transaction) => {
    const existing = await accessibleCase(transaction, caseId, actor);
    const created = await transaction.generalCaseFinancialEntry.create({
      data: {
        caseId,
        type: input.type,
        category: input.category,
        entryDate: parseDateOnly(input.entryDate)!,
        amount: input.amount,
        description: input.description,
        createdById: actor.id,
        updatedById: actor.id,
      },
      select: { id: true },
    });
    await refreshCollectionStatus(transaction, caseId, actor.id);
    await transaction.auditLog.create({
      data: {
        actorUserId: actor.id,
        event: "general_legal_case.financial_entry_created",
        targetType: "general_case_financial_entry",
        targetId: created.id,
        context: { caseId, referenceNumber: existing.referenceNumber, type: input.type, amount: input.amount.toFixed(2) },
      },
    });
    return created.id;
  });
  return { ...await getGeneralCaseFinance(caseId, actor), createdEntryId: entryId };
}

export async function updateGeneralCaseFinancialEntry(caseId: string, entryId: string, input: UpdateGeneralCaseFinancialEntryInput, actor: GeneralCaseActor) {
  await prisma.$transaction(async (transaction) => {
    const existing = await accessibleCase(transaction, caseId, actor);
    const result = await transaction.generalCaseFinancialEntry.updateMany({
      where: { id: entryId, caseId, deletedAt: null, version: input.version },
      data: {
        type: input.type,
        category: input.category,
        entryDate: parseDateOnly(input.entryDate)!,
        amount: input.amount,
        description: input.description,
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      const found = await transaction.generalCaseFinancialEntry.count({ where: { id: entryId, caseId, deletedAt: null } });
      if (!found) throw new GeneralCaseFinancialEntryNotFoundError();
      throw new GeneralCaseFinanceVersionConflictError();
    }
    await refreshCollectionStatus(transaction, caseId, actor.id);
    await transaction.auditLog.create({
      data: {
        actorUserId: actor.id,
        event: "general_legal_case.financial_entry_updated",
        targetType: "general_case_financial_entry",
        targetId: entryId,
        context: { caseId, referenceNumber: existing.referenceNumber, previousVersion: input.version, newVersion: input.version + 1 },
      },
    });
  });
  return getGeneralCaseFinance(caseId, actor);
}

export async function deleteGeneralCaseFinancialEntry(caseId: string, entryId: string, actor: GeneralCaseActor) {
  await prisma.$transaction(async (transaction) => {
    const existing = await accessibleCase(transaction, caseId, actor);
    const result = await transaction.generalCaseFinancialEntry.updateMany({
      where: { id: entryId, caseId, deletedAt: null },
      data: { deletedAt: new Date(), deletedById: actor.id, updatedById: actor.id, version: { increment: 1 } },
    });
    if (result.count !== 1) throw new GeneralCaseFinancialEntryNotFoundError();
    await refreshCollectionStatus(transaction, caseId, actor.id);
    await transaction.auditLog.create({
      data: {
        actorUserId: actor.id,
        event: "general_legal_case.financial_entry_deleted",
        targetType: "general_case_financial_entry",
        targetId: entryId,
        context: { caseId, referenceNumber: existing.referenceNumber },
      },
    });
  });
  return { id: entryId };
}

async function accessibleCase(transaction: Prisma.TransactionClient, caseId: string, actor: GeneralCaseActor) {
  const existing = await transaction.generalLegalCase.findFirst({
    where: { id: caseId, archivedAt: null, ...generalCaseAccessWhere(actor) },
    select: { id: true, referenceNumber: true },
  });
  if (!existing) throw new GeneralLegalCaseNotFoundError();
  return existing;
}

async function refreshCollectionStatus(transaction: Prisma.TransactionClient, caseId: string, actorUserId: string) {
  const legalCase = await transaction.generalLegalCase.findUniqueOrThrow({
    where: { id: caseId },
    select: { expectedCollectionAmount: true },
  });
  const collected = await sumCollections(transaction, caseId);
  await transaction.generalLegalCase.update({
    where: { id: caseId },
    data: {
      collectionStatus: collectionStatus(legalCase.expectedCollectionAmount, collected),
      updatedById: actorUserId,
      version: { increment: 1 },
    },
  });
}

async function sumCollections(transaction: Prisma.TransactionClient, caseId: string) {
  const aggregate = await transaction.generalCaseFinancialEntry.aggregate({
    where: { caseId, type: "COLLECTION", deletedAt: null },
    _sum: { amount: true },
  });
  return aggregate._sum.amount ?? new Prisma.Decimal(0);
}

function collectionStatus(expected: Prisma.Decimal, collected: Prisma.Decimal) {
  if (collected.lte(0)) return "NOT_COLLECTED" as const;
  if (expected.lte(0) || collected.gte(expected)) return "COLLECTED" as const;
  return "PARTIAL" as const;
}

function presentFinance(record: FinanceRecord) {
  const entries = record.financialEntries.map((entry) => ({
    ...entry,
    amount: entry.amount.toFixed(2),
    entryDate: dateString(entry.entryDate),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }));
  const totals = calculateGeneralCaseFinanceTotals(
    decimalToCents(record.expectedCollectionAmount),
    record.financialEntries.map((entry) => ({ type: entry.type, amountCents: decimalToCents(entry.amount) })),
  );
  return {
    id: record.id,
    referenceNumber: record.referenceNumber,
    version: record.version,
    claimAmount: record.claimAmount.toFixed(2),
    amendmentAmount: record.amendmentAmount.toFixed(2),
    interestRequested: record.interestRequested,
    interestStartDate: record.interestStartDate ? dateString(record.interestStartDate) : null,
    expectedCollectionAmount: record.expectedCollectionAmount.toFixed(2),
    opposingAttorneyFee: record.opposingAttorneyFee.toFixed(2),
    collectionStatus: record.collectionStatus,
    paymentPlan: record.paymentPlan,
    installmentCount: record.installmentCount,
    financeDescription: record.financeDescription,
    totals: {
      expense: centsToDecimalString(totals.expenseCents),
      collection: centsToDecimalString(totals.collectionCents),
      payment: centsToDecimalString(totals.paymentCents),
      remainingReceivable: centsToDecimalString(totals.remainingReceivableCents),
    },
    entries,
  };
}

function decimalToCents(value: Prisma.Decimal) {
  return BigInt(value.toFixed(2).replace(".", ""));
}

function centsToDecimalString(value: bigint) {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}

function dateString(value: Date) {
  return value.toISOString().slice(0, 10);
}
