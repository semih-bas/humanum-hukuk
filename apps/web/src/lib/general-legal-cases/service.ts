import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database";

import { generalCaseAccessWhere, type GeneralCaseActor } from "./access";
import { parseDateOnly } from "./input";
import type { GeneralLegalCaseListQuery } from "./query";

export async function listGeneralLegalCases(input: GeneralLegalCaseListQuery, actor: GeneralCaseActor) {
  const baseWhere: Prisma.GeneralLegalCaseWhereInput = {
    archivedAt: null,
    ...generalCaseAccessWhere(actor),
  };
  const query = input.query.trim();
  const where: Prisma.GeneralLegalCaseWhereInput = {
    ...baseWhere,
    ...(query ? {
      AND: [{
        OR: [
          { referenceNumber: { contains: query, mode: "insensitive" } },
          { uyapMainNumber: { contains: query, mode: "insensitive" } },
          { uyapDecisionNumber: { contains: query, mode: "insensitive" } },
          { subject: { contains: query, mode: "insensitive" } },
          { court: { contains: query, mode: "insensitive" } },
          { parties: { some: { name: { contains: query, mode: "insensitive" } } } },
        ],
      }],
    } : {}),
    ...(input.kind !== "ALL" ? { kind: input.kind } : {}),
    ...(input.status !== "ALL" ? { status: input.status } : {}),
    ...(input.stage !== "ALL" ? { stage: input.stage } : {}),
    ...(input.dateFrom || input.dateTo ? {
      openingDate: {
        ...(input.dateFrom ? { gte: parseDateOnly(input.dateFrom)! } : {}),
        ...(input.dateTo ? { lte: parseDateOnly(input.dateTo)! } : {}),
      },
    } : {}),
  };

  return prisma.$transaction(async (transaction) => {
    const [totalCount, statusGroups, kindGroups] = await Promise.all([
      transaction.generalLegalCase.count({ where }),
      transaction.generalLegalCase.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
      transaction.generalLegalCase.groupBy({ by: ["kind"], where: baseWhere, _count: { _all: true } }),
    ]);
    const pageCount = Math.max(1, Math.ceil(totalCount / input.pageSize));
    const page = Math.min(input.page, pageCount);
    const records = await transaction.generalLegalCase.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * input.pageSize,
      take: input.pageSize,
      include: {
        responsibleUser: { select: { id: true, name: true } },
        parties: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, role: true, kind: true, name: true },
        },
      },
    });
    const statusCounts = Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all]));
    const kindCounts = Object.fromEntries(kindGroups.map((group) => [group.kind, group._count._all]));
    return {
      items: records.map((record) => ({
        ...record,
        caseValue: record.caseValue.toFixed(2),
        claimAmount: record.claimAmount.toFixed(2),
        amendmentAmount: record.amendmentAmount.toFixed(2),
        expectedCollectionAmount: record.expectedCollectionAmount.toFixed(2),
        opposingAttorneyFee: record.opposingAttorneyFee.toFixed(2),
        openingDate: dateString(record.openingDate),
        interestStartDate: dateString(record.interestStartDate),
        estimatedCompletionDate: dateString(record.estimatedCompletionDate),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
      pagination: { page, pageSize: input.pageSize, pageCount, totalCount },
      summary: {
        total: kindGroups.reduce((sum, group) => sum + group._count._all, 0),
        active: (statusCounts.ACTIVE ?? 0) + (statusCounts.DECISION ?? 0) + (statusCounts.APPEAL ?? 0),
        drafts: statusCounts.DRAFT ?? 0,
        completed: (statusCounts.COMPLETED ?? 0) + (statusCounts.CLOSED ?? 0),
        generalLitigation: kindCounts.GENERAL_LITIGATION ?? 0,
        mediation: kindCounts.MEDIATION ?? 0,
      },
    };
  });
}

function dateString(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}
