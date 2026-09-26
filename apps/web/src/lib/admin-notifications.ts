import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./database";

export type NotificationSource = "enforcement" | "insurance" | "general";

export type AdminNotification = {
  id: string;
  source: NotificationSource;
  caseFileId: string;
  title: string;
  dueAt: string;
  status: "PENDING" | "PARTIALLY_SENT" | "FAILED";
  referenceNumber: string;
  vehiclePlate: string;
};

export async function listAdminNotifications() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const enforcementWhere: Prisma.CaseReminderWhereInput = { status: { in: ["PENDING", "PARTIALLY_SENT", "FAILED"] }, dueAt: { lte: windowEnd }, caseFile: { archivedAt: null } };
  const insuranceWhere: Prisma.InsuranceArbitrationNotificationWhereInput = { status: { in: ["PENDING", "PARTIALLY_SENT", "FAILED"] }, notifyAt: { lte: windowEnd }, deletedAt: null, case: { archivedAt: null } };
  const generalWhere: Prisma.GeneralCaseTaskWhereInput = { status: { in: ["PENDING", "PLANNED", "PARTIALLY_SENT", "FAILED"] }, notifyAt: { lte: windowEnd }, deletedAt: null, case: { archivedAt: null } };
  const [enforcementCount, insuranceCount, generalCount, reminders, insurance, general] = await Promise.all([
    prisma.caseReminder.count({ where: enforcementWhere }),
    prisma.insuranceArbitrationNotification.count({ where: insuranceWhere }),
    prisma.generalCaseTask.count({ where: generalWhere }),
    prisma.caseReminder.findMany({ where: enforcementWhere, orderBy: [{ dueAt: "asc" }, { id: "asc" }], take: 5, select: { id: true, title: true, eventAt: true, status: true, caseFile: { select: { id: true, referenceNumber: true, vehiclePlate: true } } } }),
    prisma.insuranceArbitrationNotification.findMany({ where: insuranceWhere, orderBy: [{ notifyAt: "asc" }, { id: "asc" }], take: 5, select: { id: true, title: true, eventAt: true, status: true, case: { select: { id: true, referenceNumber: true, vehiclePlate: true } } } }),
    prisma.generalCaseTask.findMany({ where: generalWhere, orderBy: [{ notifyAt: "asc" }, { id: "asc" }], take: 5, select: { id: true, title: true, dueAt: true, status: true, case: { select: { id: true, referenceNumber: true, caseType: true } } } }),
  ]);
  const items: AdminNotification[] = [
    ...reminders.map((item) => ({ id: item.id, source: "enforcement" as const, caseFileId: item.caseFile.id, title: item.title, dueAt: item.eventAt.toISOString(), status: item.status as AdminNotification["status"], referenceNumber: item.caseFile.referenceNumber, vehiclePlate: item.caseFile.vehiclePlate })),
    ...insurance.map((item) => ({ id: item.id, source: "insurance" as const, caseFileId: item.case.id, title: item.title, dueAt: item.eventAt.toISOString(), status: item.status as AdminNotification["status"], referenceNumber: item.case.referenceNumber, vehiclePlate: item.case.vehiclePlate })),
    ...general.map((item) => ({ id: item.id, source: "general" as const, caseFileId: item.case.id, title: item.title, dueAt: item.dueAt.toISOString(), status: item.status as AdminNotification["status"], referenceNumber: item.case.referenceNumber, vehiclePlate: item.case.caseType })),
  ].sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.id.localeCompare(right.id)).slice(0, 5);
  return { items, totalCount: enforcementCount + insuranceCount + generalCount, generatedAt: now.toISOString() };
}

export async function listAdminReminderTasks() {
  const now = new Date();
  const enforcementWhere: Prisma.CaseReminderWhereInput = { status: { not: "CANCELLED" }, caseFile: { archivedAt: null } };
  const insuranceWhere: Prisma.InsuranceArbitrationNotificationWhereInput = { status: { not: "CANCELLED" }, deletedAt: null, case: { archivedAt: null } };
  const generalWhere: Prisma.GeneralCaseTaskWhereInput = { status: { not: "CANCELLED" }, deletedAt: null, case: { archivedAt: null } };
  const [enforcementCount, insuranceCount, generalCount, reminders, insurance, general] = await Promise.all([
    prisma.caseReminder.count({ where: enforcementWhere }),
    prisma.insuranceArbitrationNotification.count({ where: insuranceWhere }),
    prisma.generalCaseTask.count({ where: generalWhere }),
    prisma.caseReminder.findMany({ where: enforcementWhere, orderBy: [{ eventAt: "asc" }, { id: "asc" }], take: 200, select: { id: true, title: true, eventAt: true, status: true, caseFile: { select: { id: true, referenceNumber: true, vehiclePlate: true } }, createdBy: { select: { name: true } }, deliveries: { select: { status: true, failureCode: true } } } }),
    prisma.insuranceArbitrationNotification.findMany({ where: insuranceWhere, orderBy: [{ eventAt: "asc" }, { id: "asc" }], take: 200, select: { id: true, title: true, eventAt: true, status: true, case: { select: { id: true, referenceNumber: true, vehiclePlate: true } }, createdBy: { select: { name: true } }, deliveries: { select: { status: true, failureCode: true } } } }),
    prisma.generalCaseTask.findMany({ where: generalWhere, orderBy: [{ dueAt: "asc" }, { id: "asc" }], take: 200, select: { id: true, title: true, dueAt: true, status: true, case: { select: { id: true, referenceNumber: true, caseType: true } }, createdBy: { select: { name: true } }, deliveries: { select: { status: true, failureCode: true } } } }),
  ]);
  const items = [
    ...reminders.map((item) => ({ ...item, source: "enforcement" as const, dueAt: item.eventAt.toISOString(), eventAt: item.eventAt.toISOString(), overdue: item.eventAt < now })),
    ...insurance.map((item) => ({ id: item.id, title: item.title, source: "insurance" as const, caseFile: item.case, createdBy: item.createdBy, deliveries: item.deliveries, status: item.status, dueAt: item.eventAt.toISOString(), eventAt: item.eventAt.toISOString(), overdue: item.eventAt < now })),
    ...general.map((item) => ({ id: item.id, title: item.title, source: "general" as const, caseFile: { ...item.case, vehiclePlate: item.case.caseType }, createdBy: item.createdBy, deliveries: item.deliveries, status: item.status, dueAt: item.dueAt.toISOString(), eventAt: item.dueAt.toISOString(), overdue: item.dueAt < now })),
  ].sort((left, right) => left.eventAt.localeCompare(right.eventAt) || left.id.localeCompare(right.id)).slice(0, 200);
  return { totalCount: enforcementCount + insuranceCount + generalCount, items };
}
