import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database";
import type { InsuranceCaseInput } from "./input";
import { parseDate } from "./input";
import type { InsuranceStatus } from "./presentation";

export type InsuranceListInput = { query: string; status: "ALL" | "ARBITRATION_GROUP" | "COMPLETED_GROUP" | InsuranceStatus; insuranceCompany: string; arbitration: "ALL" | "YES" | "NO"; dateFrom: string | null; dateTo: string | null; page: number; pageSize: number };

export async function listInsuranceCases(input: InsuranceListInput) {
  const query = input.query.trim();
  const where: Prisma.InsuranceArbitrationCaseWhereInput = {
    ...(query ? { OR: [{ arbitrationApplicationNo: { contains: query, mode: "insensitive" } }, { arbitrationCaseNumber: { contains: query, mode: "insensitive" } }, { vehiclePlate: { contains: query, mode: "insensitive" } }, { vehicleOwner: { contains: query, mode: "insensitive" } }, { identityNumber: { contains: query, mode: "insensitive" } }, { opposingInsuranceCompany: { contains: query, mode: "insensitive" } }] } : {}),
    ...(input.status === "ARBITRATION_GROUP" ? { status: { in: ["ARBITRATION_APPLICATION", "ARBITRATION", "EXPERT_REVIEW"] } } : input.status === "COMPLETED_GROUP" ? { status: { in: ["COMPLETED", "CLOSED"] } } : input.status !== "ALL" ? { status: input.status } : {}),
    ...(input.insuranceCompany ? { opposingInsuranceCompany: { equals: input.insuranceCompany, mode: "insensitive" } } : {}),
    ...(input.arbitration !== "ALL" ? { hasArbitration: input.arbitration === "YES" } : {}),
    ...(input.dateFrom || input.dateTo ? { accidentDate: { ...(input.dateFrom ? { gte: parseDate(input.dateFrom)! } : {}), ...(input.dateTo ? { lte: parseDate(input.dateTo)! } : {}) } } : {}),
  };
  return prisma.$transaction(async (transaction) => {
    const [totalCount, statusGroups, companies] = await Promise.all([
      transaction.insuranceArbitrationCase.count({ where }),
      transaction.insuranceArbitrationCase.groupBy({ by: ["status"], _count: { _all: true } }),
      transaction.insuranceArbitrationCase.findMany({ distinct: ["opposingInsuranceCompany"], orderBy: { opposingInsuranceCompany: "asc" }, select: { opposingInsuranceCompany: true } }),
    ]);
    const pageCount = Math.max(1, Math.ceil(totalCount / input.pageSize)); const page = Math.min(input.page, pageCount);
    const records = await transaction.insuranceArbitrationCase.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (page - 1) * input.pageSize, take: input.pageSize });
    const counts = Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all])); const allCount = statusGroups.reduce((sum, group) => sum + group._count._all, 0);
    return {
      items: records.map((record) => ({ ...record, accidentDate: dateString(record.accidentDate), insuranceApplicationDate: dateString(record.insuranceApplicationDate), arbitrationApplicationDate: dateString(record.arbitrationApplicationDate), updatedAt: record.updatedAt.toISOString() })),
      pagination: { page, pageSize: input.pageSize, pageCount, totalCount }, companies: companies.map((item) => item.opposingInsuranceCompany),
      summary: { total: allCount, arbitration: (counts.ARBITRATION ?? 0) + (counts.ARBITRATION_APPLICATION ?? 0) + (counts.EXPERT_REVIEW ?? 0), paymentPending: counts.PAYMENT_PENDING ?? 0, enforcement: counts.ENFORCEMENT ?? 0, completed: (counts.COMPLETED ?? 0) + (counts.CLOSED ?? 0) },
    };
  });
}

export async function createInsuranceCase(input: InsuranceCaseInput, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const [sequence] = await transaction.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('insurance_arbitration_reference_sequence') AS value`;
    if (!sequence) throw new Error("Insurance case reference sequence unavailable.");
    const year = new Intl.DateTimeFormat("en", { timeZone: "Europe/Istanbul", year: "numeric" }).format(new Date()); const referenceNumber = `ST-${year}-${sequence.value.toString().padStart(6, "0")}`;
    const { payments, ...caseInput } = input;
    const record = await transaction.insuranceArbitrationCase.create({ data: { ...caseInput, referenceNumber, accidentDate: parseDate(input.accidentDate)!, policyExpiryDate: parseDate(input.policyExpiryDate), postalDeliveryDate: parseDate(input.postalDeliveryDate), insuranceApplicationDate: parseDate(input.insuranceApplicationDate), arbitrationApplicationDate: input.hasArbitration ? parseDate(input.arbitrationApplicationDate) : null, arbitrationApplicationNo: input.hasArbitration ? input.arbitrationApplicationNo : null, arbitrationCaseNumber: input.hasArbitration ? input.arbitrationCaseNumber : null, payments: { create: payments.map((payment) => ({ type: payment.type, paymentDate: parseDate(payment.paymentDate)!, amount: payment.amount, commission: payment.commission, clientAmount: payment.amount.minus(payment.commission), description: payment.description })) }, createdById: actorUserId, updatedById: actorUserId }, select: { id: true, referenceNumber: true } });
    await transaction.auditLog.create({ data: { actorUserId, event: "insurance_arbitration_case.created", targetType: "insurance_arbitration_case", targetId: record.id, context: { referenceNumber } } });
    return record;
  });
}
function dateString(value: Date | null) { return value?.toISOString().slice(0, 10) ?? null; }
