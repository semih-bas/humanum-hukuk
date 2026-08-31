import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "./database";

export type AdminNotification = {
  id: string;
  caseFileId: string;
  title: string;
  dueAt: string;
  status: "PENDING" | "PARTIALLY_SENT" | "FAILED";
  referenceNumber: string;
  vehiclePlate: string;
};

export type AdminNotificationResult = {
  items: AdminNotification[];
  totalCount: number;
  generatedAt: string;
};

export async function listAdminNotifications(): Promise<AdminNotificationResult> {
  const now = new Date();
  const notificationWindowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const where: Prisma.CaseReminderWhereInput = {
    status: { in: ["PENDING", "PARTIALLY_SENT", "FAILED"] },
    dueAt: { lte: notificationWindowEnd },
    caseFile: { archivedAt: null },
  };

  return prisma.$transaction(async (transaction) => {
    const [totalCount, reminders] = await Promise.all([
      transaction.caseReminder.count({ where }),
      transaction.caseReminder.findMany({
        where,
        orderBy: [{ dueAt: "asc" }, { id: "asc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          dueAt: true,
          status: true,
          caseFile: {
            select: {
              id: true,
              referenceNumber: true,
              vehiclePlate: true,
            },
          },
        },
      }),
    ]);

    return {
      items: reminders.map((reminder) => ({
        id: reminder.id,
        caseFileId: reminder.caseFile.id,
        title: reminder.title,
        dueAt: reminder.dueAt.toISOString(),
        status: reminder.status as AdminNotification["status"],
        referenceNumber: reminder.caseFile.referenceNumber,
        vehiclePlate: reminder.caseFile.vehiclePlate,
      })),
      totalCount,
      generatedAt: now.toISOString(),
    };
  }, { isolationLevel: "RepeatableRead" });
}

export async function listAdminReminderTasks() {
  const now = new Date();
  const where: Prisma.CaseReminderWhereInput = {
    status: { in: ["PENDING", "PARTIALLY_SENT", "FAILED"] },
    caseFile: { archivedAt: null },
  };
  const [totalCount, reminders] = await prisma.$transaction([
    prisma.caseReminder.count({ where }),
    prisma.caseReminder.findMany({
      where,
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        dueAt: true,
        status: true,
        caseFile: { select: { id: true, referenceNumber: true, vehiclePlate: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);
  return {
    totalCount,
    items: reminders.map((reminder) => ({ ...reminder, dueAt: reminder.dueAt.toISOString(), overdue: reminder.dueAt < now })),
  };
}
