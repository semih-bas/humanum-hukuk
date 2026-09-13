import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database";
import type { CreateTransactionInput, UpdateTransactionInput } from "./transaction-input";
import { CaseNotFoundError } from "./update-case";

export class CaseTransactionNotFoundError extends Error {}

const transactionSelect = {
  id: true,
  type: true,
  category: true,
  transactionDate: true,
  amount: true,
  description: true,
  createdAt: true,
  documents: { select: { id: true, originalName: true }, orderBy: { createdAt: "asc" as const } },
} as const;

export async function listCaseTransactions(caseFileId: string) {
  const caseFile = await prisma.caseFile.findFirst({
    where: { id: caseFileId, archivedAt: null },
    select: {
      id: true,
      notes: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true } },
      transactions: { where: { deletedAt: null }, orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }], select: transactionSelect },
    },
  });
  if (!caseFile) throw new CaseNotFoundError();
  return present(caseFile.transactions, caseFile.notes[0]?.content ?? "");
}

export async function createCaseTransaction(caseFileId: string, input: CreateTransactionInput, actorUserId: string) {
  const createdTransactionId = await prisma.$transaction(async (transaction) => {
    const caseFile = await transaction.caseFile.findFirst({ where: { id: caseFileId, archivedAt: null }, select: { id: true, referenceNumber: true } });
    if (!caseFile) throw new CaseNotFoundError();

    const created = await transaction.caseTransaction.create({
      data: {
        caseFileId,
        type: input.type,
        category: input.category,
        transactionDate: new Date(`${input.transactionDate}T00:00:00.000Z`),
        amount: input.amount,
        description: input.description.trim(),
        createdById: actorUserId,
      },
      select: { id: true },
    });

    const note = input.caseNote?.trim();
    if (note) {
      const latest = await transaction.caseNote.findFirst({ where: { caseFileId }, orderBy: { createdAt: "desc" }, select: { id: true, content: true } });
      if (!latest) await transaction.caseNote.create({ data: { caseFileId, authorId: actorUserId, content: note } });
      else if (latest.content !== note) await transaction.caseNote.update({ where: { id: latest.id }, data: { content: note, authorId: actorUserId } });
    }

    await transaction.auditLog.create({ data: { actorUserId, event: "case.transaction_created", targetType: "case_transaction", targetId: created.id, context: { caseFileId, referenceNumber: caseFile.referenceNumber, type: input.type, category: input.category, amount: input.amount.toFixed(2) } } });
    return created.id;
  });
  return { ...await listCaseTransactions(caseFileId), createdTransactionId };
}

export async function deleteCaseTransaction(caseFileId: string, id: string, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.caseTransaction.updateMany({ where: { id, caseFileId, deletedAt: null, caseFile: { archivedAt: null } }, data: { deletedAt: new Date(), deletedById: actorUserId } });
    if (result.count !== 1) throw new CaseTransactionNotFoundError();
    await transaction.auditLog.create({ data: { actorUserId, event: "case.transaction_deleted", targetType: "case_transaction", targetId: id, context: { caseFileId } } });
    return { id };
  });
}

export async function updateCaseTransaction(caseFileId: string, id: string, input: UpdateTransactionInput, actorUserId: string) {
  await prisma.$transaction(async (transaction) => {
    const result = await transaction.caseTransaction.updateMany({
      where: { id, caseFileId, deletedAt: null, caseFile: { archivedAt: null } },
      data: { type: input.type, category: input.category, transactionDate: new Date(`${input.transactionDate}T00:00:00.000Z`), amount: input.amount, description: input.description.trim() },
    });
    if (result.count !== 1) throw new CaseTransactionNotFoundError();

    const note = input.caseNote?.trim();
    if (note) {
      const latest = await transaction.caseNote.findFirst({ where: { caseFileId }, orderBy: { createdAt: "desc" }, select: { id: true, content: true } });
      if (!latest) await transaction.caseNote.create({ data: { caseFileId, authorId: actorUserId, content: note } });
      else if (latest.content !== note) await transaction.caseNote.update({ where: { id: latest.id }, data: { content: note, authorId: actorUserId } });
    }

    await transaction.auditLog.create({ data: { actorUserId, event: "case.transaction_updated", targetType: "case_transaction", targetId: id, context: { caseFileId, type: input.type, category: input.category, amount: input.amount.toFixed(2) } } });
  });
  return listCaseTransactions(caseFileId);
}

function present(transactions: Array<{ id: string; type: "INCOME" | "EXPENSE"; category: string; transactionDate: Date; amount: Prisma.Decimal; description: string; createdAt: Date; documents: Array<{ id: string; originalName: string }> }>, caseNote: string) {
  let income = new Prisma.Decimal(0);
  let expense = new Prisma.Decimal(0);
  for (const item of transactions) {
    if (item.type === "INCOME") income = income.add(item.amount);
    else expense = expense.add(item.amount);
  }
  return {
    items: transactions.map((item) => ({ ...item, transactionDate: item.transactionDate.toISOString().slice(0, 10), amount: item.amount.toFixed(2), createdAt: item.createdAt.toISOString() })),
    totals: { income: income.toFixed(2), expense: expense.toFixed(2), net: income.sub(expense).toFixed(2) },
    caseNote,
  };
}
