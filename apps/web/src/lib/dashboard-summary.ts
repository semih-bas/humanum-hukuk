import { Prisma } from "@/generated/prisma/client";

import { prisma } from "./database";

type AmountAggregate = {
  _sum: {
    damageAmount: Prisma.Decimal | null;
    depreciationAmount: Prisma.Decimal | null;
    profitLossAmount: Prisma.Decimal | null;
    discountAmount: Prisma.Decimal | null;
  };
};

export type DashboardSummary = {
  counts: {
    open: number;
    closed: number;
    total: number;
  };
  percentages: {
    open: number;
    closed: number;
  };
  financials: {
    totalReceivable: string;
    collected: string;
    outstanding: string;
  };
  reminders: Array<{
    id: string;
    caseFileId: string;
    title: string;
    dueAt: string;
    referenceNumber: string;
    vehiclePlate: string;
  }>;
};

export async function getDashboardSummary(includeReminders: boolean): Promise<DashboardSummary> {
  return prisma.$transaction(async (transaction) => {
    const [statusGroups, totalAmounts, closedAmounts, reminders] = await Promise.all([
      transaction.caseFile.groupBy({
        by: ["status"],
        where: { archivedAt: null },
        _count: { _all: true },
      }),
      transaction.caseFile.aggregate({
        where: { archivedAt: null },
        _sum: {
          damageAmount: true,
          depreciationAmount: true,
          profitLossAmount: true,
          discountAmount: true,
        },
      }),
      transaction.caseFile.aggregate({
        where: { archivedAt: null, status: "CLOSED" },
        _sum: {
          damageAmount: true,
          depreciationAmount: true,
          profitLossAmount: true,
          discountAmount: true,
        },
      }),
      includeReminders ? transaction.caseReminder.findMany({
        where: {
          status: "PENDING",
          dueAt: { gte: new Date() },
          caseFile: { archivedAt: null },
        },
        orderBy: [{ dueAt: "asc" }, { id: "asc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          dueAt: true,
          caseFile: {
            select: {
              id: true,
              referenceNumber: true,
              vehiclePlate: true,
            },
          },
        },
      }) : Promise.resolve([]),
    ]);

    const closed = statusGroups.find((group) => group.status === "CLOSED")?._count._all ?? 0;
    const total = statusGroups.reduce((sum, group) => sum + group._count._all, 0);
    const open = total - closed;
    const totalReceivable = calculateNetAmount(totalAmounts);
    const collected = calculateNetAmount(closedAmounts);
    const outstanding = Prisma.Decimal.max(totalReceivable.sub(collected), 0);

    return {
      counts: { open, closed, total },
      percentages: {
        open: percentage(open, total),
        closed: percentage(closed, total),
      },
      financials: {
        totalReceivable: totalReceivable.toFixed(2),
        collected: collected.toFixed(2),
        outstanding: outstanding.toFixed(2),
      },
      reminders: reminders.map((reminder) => ({
        id: reminder.id,
        caseFileId: reminder.caseFile.id,
        title: reminder.title,
        dueAt: reminder.dueAt.toISOString(),
        referenceNumber: reminder.caseFile.referenceNumber,
        vehiclePlate: reminder.caseFile.vehiclePlate,
      })),
    };
  }, { isolationLevel: "RepeatableRead" });
}

function calculateNetAmount(aggregate: AmountAggregate): Prisma.Decimal {
  return new Prisma.Decimal(aggregate._sum.damageAmount ?? 0)
    .add(aggregate._sum.depreciationAmount ?? 0)
    .add(aggregate._sum.profitLossAmount ?? 0)
    .sub(aggregate._sum.discountAmount ?? 0);
}

function percentage(value: number, total: number): number {
  return total === 0 ? 0 : Number(((value / total) * 100).toFixed(1));
}
