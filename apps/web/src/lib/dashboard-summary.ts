import { prisma } from "./database";

type ModuleKey = "enforcement" | "insurance" | "general";

export type DashboardSummary = {
  modules: Record<ModuleKey, { total: number; active: number }>;
  totals: { total: number; active: number; thisWeek: number };
  criticalDates: Array<{ id: string; module: ModuleKey; title: string; referenceNumber: string; date: string; href: string; priority: "urgent" | "soon" | "normal" }>;
  recentFiles: Array<{ id: string; module: ModuleKey; referenceNumber: string; subject: string; status: string; updatedAt: string; href: string }>;
  financialMovements: Array<{ id: string; module: ModuleKey; description: string; amount: string; date: string; income: boolean; href: string }>;
};

const closedInsuranceStatuses = ["COMPLETED", "CLOSED"] as const;
const closedGeneralStatuses = ["COMPLETED", "CLOSED"] as const;

export async function getDashboardSummary(includeNotifications: boolean): Promise<DashboardSummary> {
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (transaction) => {
    const [
      enforcementTotal, enforcementActive, insuranceTotal, insuranceActive, generalTotal, generalActive,
      enforcementReminders, insuranceNotifications, generalTasks, hearings,
      enforcementWeek, insuranceWeek, generalTaskWeek, hearingWeek,
      enforcementRecent, insuranceRecent, generalRecent,
      enforcementMovements, insuranceMovements, generalMovements,
    ] = await Promise.all([
      transaction.caseFile.count({ where: { archivedAt: null } }),
      transaction.caseFile.count({ where: { archivedAt: null, status: { not: "CLOSED" } } }),
      transaction.insuranceArbitrationCase.count({ where: { archivedAt: null } }),
      transaction.insuranceArbitrationCase.count({ where: { archivedAt: null, status: { notIn: [...closedInsuranceStatuses] } } }),
      transaction.generalLegalCase.count({ where: { archivedAt: null } }),
      transaction.generalLegalCase.count({ where: { archivedAt: null, status: { notIn: [...closedGeneralStatuses] } } }),
      includeNotifications ? transaction.caseReminder.findMany({ where: { status: "PENDING", caseFile: { archivedAt: null } }, orderBy: [{ eventAt: "asc" }], take: 8, select: { id: true, title: true, eventAt: true, priority: true, caseFile: { select: { id: true, referenceNumber: true } } } }) : Promise.resolve([]),
      includeNotifications ? transaction.insuranceArbitrationNotification.findMany({ where: { deletedAt: null, status: { in: ["PENDING", "PARTIALLY_SENT", "FAILED"] }, case: { archivedAt: null } }, orderBy: [{ eventAt: "asc" }], take: 8, select: { id: true, title: true, eventAt: true, priority: true, case: { select: { id: true, referenceNumber: true } } } }) : Promise.resolve([]),
      includeNotifications ? transaction.generalCaseTask.findMany({ where: { deletedAt: null, status: { notIn: ["COMPLETED", "SENT", "CANCELLED"] }, case: { archivedAt: null } }, orderBy: [{ dueAt: "asc" }], take: 8, select: { id: true, title: true, dueAt: true, priority: true, case: { select: { id: true, referenceNumber: true } } } }) : Promise.resolve([]),
      transaction.generalCaseHearing.findMany({ where: { deletedAt: null, status: "PLANNED", startsAt: { gte: now }, case: { archivedAt: null } }, orderBy: [{ startsAt: "asc" }], take: 8, select: { id: true, hearingType: true, startsAt: true, case: { select: { id: true, referenceNumber: true } } } }),
      includeNotifications ? transaction.caseReminder.count({ where: { status: "PENDING", eventAt: { gte: now, lte: weekEnd }, caseFile: { archivedAt: null } } }) : Promise.resolve(0),
      includeNotifications ? transaction.insuranceArbitrationNotification.count({ where: { deletedAt: null, status: { in: ["PENDING", "PARTIALLY_SENT", "FAILED"] }, eventAt: { gte: now, lte: weekEnd }, case: { archivedAt: null } } }) : Promise.resolve(0),
      includeNotifications ? transaction.generalCaseTask.count({ where: { deletedAt: null, status: { notIn: ["COMPLETED", "SENT", "CANCELLED"] }, dueAt: { gte: now, lte: weekEnd }, case: { archivedAt: null } } }) : Promise.resolve(0),
      transaction.generalCaseHearing.count({ where: { deletedAt: null, status: "PLANNED", startsAt: { gte: now, lte: weekEnd }, case: { archivedAt: null } } }),
      transaction.caseFile.findMany({ where: { archivedAt: null }, orderBy: [{ updatedAt: "desc" }], take: 5, select: { id: true, referenceNumber: true, licenseHolder: true, vehiclePlate: true, status: true, updatedAt: true } }),
      transaction.insuranceArbitrationCase.findMany({ where: { archivedAt: null }, orderBy: [{ updatedAt: "desc" }], take: 5, select: { id: true, referenceNumber: true, opposingInsuranceCompany: true, vehiclePlate: true, status: true, updatedAt: true } }),
      transaction.generalLegalCase.findMany({ where: { archivedAt: null }, orderBy: [{ updatedAt: "desc" }], take: 5, select: { id: true, referenceNumber: true, subject: true, status: true, updatedAt: true } }),
      transaction.caseTransaction.findMany({ where: { deletedAt: null, caseFile: { archivedAt: null } }, orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }], take: 5, select: { id: true, type: true, description: true, amount: true, transactionDate: true, caseFile: { select: { id: true } } } }),
      transaction.insuranceArbitrationPayment.findMany({ where: { case: { archivedAt: null } }, orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }], take: 5, select: { id: true, type: true, description: true, amount: true, paymentDate: true, case: { select: { id: true } } } }),
      transaction.generalCaseFinancialEntry.findMany({ where: { deletedAt: null, case: { archivedAt: null } }, orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }], take: 5, select: { id: true, type: true, category: true, description: true, amount: true, entryDate: true, case: { select: { id: true } } } }),
    ]);

    const criticalDates: DashboardSummary["criticalDates"] = [
      ...enforcementReminders.map((item) => ({ id: `enforcement-${item.id}`, module: "enforcement" as const, title: item.title, referenceNumber: item.caseFile.referenceNumber, date: item.eventAt.toISOString(), href: `/dosyalarim?case=${encodeURIComponent(item.caseFile.id)}`, priority: datePriority(item.eventAt, now, item.priority) })),
      ...insuranceNotifications.map((item) => ({ id: `insurance-${item.id}`, module: "insurance" as const, title: item.title, referenceNumber: item.case.referenceNumber, date: item.eventAt.toISOString(), href: `/sigorta-ve-tahkim/${encodeURIComponent(item.case.id)}`, priority: datePriority(item.eventAt, now, item.priority) })),
      ...generalTasks.map((item) => ({ id: `general-task-${item.id}`, module: "general" as const, title: item.title, referenceNumber: item.case.referenceNumber, date: item.dueAt.toISOString(), href: `/genel-dava-ve-arabuluculuk?case=${encodeURIComponent(item.case.id)}`, priority: datePriority(item.dueAt, now, item.priority) })),
      ...hearings.map((item) => ({ id: `hearing-${item.id}`, module: "general" as const, title: item.hearingType, referenceNumber: item.case.referenceNumber, date: item.startsAt.toISOString(), href: `/genel-dava-ve-arabuluculuk?case=${encodeURIComponent(item.case.id)}`, priority: datePriority(item.startsAt, now, "HIGH") })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 6);

    const recentFiles: DashboardSummary["recentFiles"] = [
      ...enforcementRecent.map((item) => ({ id: `enforcement-${item.id}`, module: "enforcement" as const, referenceNumber: item.referenceNumber, subject: `${item.licenseHolder} · ${item.vehiclePlate}`, status: item.status, updatedAt: item.updatedAt.toISOString(), href: `/dosyalarim?case=${encodeURIComponent(item.id)}` })),
      ...insuranceRecent.map((item) => ({ id: `insurance-${item.id}`, module: "insurance" as const, referenceNumber: item.referenceNumber, subject: `${item.opposingInsuranceCompany} · ${item.vehiclePlate}`, status: item.status, updatedAt: item.updatedAt.toISOString(), href: `/sigorta-ve-tahkim/${encodeURIComponent(item.id)}` })),
      ...generalRecent.map((item) => ({ id: `general-${item.id}`, module: "general" as const, referenceNumber: item.referenceNumber, subject: item.subject, status: item.status, updatedAt: item.updatedAt.toISOString(), href: `/genel-dava-ve-arabuluculuk?case=${encodeURIComponent(item.id)}` })),
    ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);

    const financialMovements: DashboardSummary["financialMovements"] = [
      ...enforcementMovements.map((item) => ({ id: `enforcement-${item.id}`, module: "enforcement" as const, description: item.description, amount: item.amount.toFixed(2), date: item.transactionDate.toISOString(), income: item.type === "INCOME", href: `/dosyalarim?case=${encodeURIComponent(item.caseFile.id)}` })),
      ...insuranceMovements.map((item) => ({ id: `insurance-${item.id}`, module: "insurance" as const, description: item.description || insurancePaymentLabel(item.type), amount: item.amount.toFixed(2), date: item.paymentDate.toISOString(), income: item.type !== "OUTGOING_PAYMENT", href: `/sigorta-ve-tahkim/${encodeURIComponent(item.case.id)}` })),
      ...generalMovements.map((item) => ({ id: `general-${item.id}`, module: "general" as const, description: item.description || item.category, amount: item.amount.toFixed(2), date: item.entryDate.toISOString(), income: item.type === "COLLECTION", href: `/genel-dava-ve-arabuluculuk?case=${encodeURIComponent(item.case.id)}` })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

    return {
      modules: {
        enforcement: { total: enforcementTotal, active: enforcementActive },
        insurance: { total: insuranceTotal, active: insuranceActive },
        general: { total: generalTotal, active: generalActive },
      },
      totals: {
        total: enforcementTotal + insuranceTotal + generalTotal,
        active: enforcementActive + insuranceActive + generalActive,
        thisWeek: enforcementWeek + insuranceWeek + generalTaskWeek + hearingWeek,
      },
      criticalDates,
      recentFiles,
      financialMovements,
    };
  }, { isolationLevel: "RepeatableRead" });
}

function datePriority(date: Date, now: Date, priority: string): "urgent" | "soon" | "normal" {
  const hours = (date.getTime() - now.getTime()) / 3_600_000;
  if (hours < 0 || priority === "HIGH" && hours <= 48) return "urgent";
  if (hours <= 72 || priority === "MEDIUM" && hours <= 48) return "soon";
  return "normal";
}

function insurancePaymentLabel(type: string): string {
  return type === "OUTGOING_PAYMENT" ? "Ödeme" : type === "INSURANCE_INCOME" ? "Sigorta tahsilatı" : type === "ARBITRATION_INCOME" ? "Tahkim tahsilatı" : "İcra tahsilatı";
}
