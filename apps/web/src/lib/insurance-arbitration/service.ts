import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database";
import type { InsuranceCaseInput, UpdateInsuranceCaseInput } from "./input";
import { parseDate } from "./input";
import type { InsuranceStatus } from "./presentation";

export type InsuranceListInput = { query: string; status: "ALL" | "ARBITRATION_GROUP" | "INSURANCE_GROUP" | "FOLLOW_UP_GROUP" | "COMPLETED_GROUP" | InsuranceStatus; arbitration: "ALL" | "YES" | "NO"; dateFrom: string | null; dateTo: string | null; page: number; pageSize: number };
type InsuranceCaseRecord = Prisma.InsuranceArbitrationCaseGetPayload<{ include: { payments: true; documents: { select: { id: true; originalName: true } } } }>;

export async function listInsuranceCases(input: InsuranceListInput) {
  const query = input.query.trim();
  const where: Prisma.InsuranceArbitrationCaseWhereInput = {
    archivedAt: null,
    ...(query ? { OR: [{ arbitrationApplicationNo: { contains: query, mode: "insensitive" } }, { opposingPolicyNumber: { contains: query, mode: "insensitive" } }, { vehiclePlate: { contains: query, mode: "insensitive" } }, { vehicleOwner: { contains: query, mode: "insensitive" } }, { identityNumber: { contains: query, mode: "insensitive" } }, { opposingIdentityNumber: { contains: query, mode: "insensitive" } }] } : {}),
    ...(input.status === "ARBITRATION_GROUP" ? { status: { in: ["ARBITRATION_APPLICATION", "ARBITRATION", "EXPERT_REVIEW"] } } : input.status === "INSURANCE_GROUP" ? { status: { in: ["INSURANCE_APPLICATION", "SETTLEMENT_REVIEW", "INSURANCE_PAYMENT_RECEIVED"] } } : input.status === "FOLLOW_UP_GROUP" ? { status: { in: ["PAYMENT_PENDING", "ENFORCEMENT", "LITIGATION"] } } : input.status === "COMPLETED_GROUP" ? { status: { in: ["COMPLETED", "CLOSED"] } } : input.status !== "ALL" ? { status: input.status } : {}),
    ...(input.arbitration !== "ALL" ? { hasArbitration: input.arbitration === "YES" } : {}),
    ...(input.dateFrom || input.dateTo ? { accidentDate: { ...(input.dateFrom ? { gte: parseDate(input.dateFrom)! } : {}), ...(input.dateTo ? { lte: parseDate(input.dateTo)! } : {}) } } : {}),
  };
  return prisma.$transaction(async (transaction) => {
    const [totalCount, statusGroups] = await Promise.all([
      transaction.insuranceArbitrationCase.count({ where }),
      transaction.insuranceArbitrationCase.groupBy({ by: ["status"], where: { archivedAt: null }, _count: { _all: true } }),
    ]);
    const pageCount = Math.max(1, Math.ceil(totalCount / input.pageSize)); const page = Math.min(input.page, pageCount);
    const records = await transaction.insuranceArbitrationCase.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (page - 1) * input.pageSize, take: input.pageSize });
    const counts = Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all])); const allCount = statusGroups.reduce((sum, group) => sum + group._count._all, 0);
    return {
      items: records.map((record) => ({ ...record, accidentDate: dateString(record.accidentDate), insuranceApplicationDate: dateString(record.insuranceApplicationDate), arbitrationApplicationDate: dateString(record.arbitrationApplicationDate), updatedAt: record.updatedAt.toISOString() })),
      pagination: { page, pageSize: input.pageSize, pageCount, totalCount },
      summary: { total: allCount, arbitration: (counts.ARBITRATION ?? 0) + (counts.ARBITRATION_APPLICATION ?? 0) + (counts.EXPERT_REVIEW ?? 0), insurance: (counts.INSURANCE_APPLICATION ?? 0) + (counts.SETTLEMENT_REVIEW ?? 0) + (counts.INSURANCE_PAYMENT_RECEIVED ?? 0), followUp: (counts.PAYMENT_PENDING ?? 0) + (counts.ENFORCEMENT ?? 0) + (counts.LITIGATION ?? 0), completed: (counts.COMPLETED ?? 0) + (counts.CLOSED ?? 0) },
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

export class InsuranceCaseNotFoundError extends Error {}
export class InsuranceCaseVersionConflictError extends Error {}

export async function getInsuranceCase(id: string) {
  const record = await prisma.insuranceArbitrationCase.findFirst({ where: { id, archivedAt: null }, include: { payments: { orderBy: { paymentDate: "desc" } }, documents: { orderBy: { createdAt: "asc" }, select: { id: true, originalName: true } } } });
  if (!record) throw new InsuranceCaseNotFoundError();
  return presentCase(record);
}

export async function updateInsuranceCase(id: string, input: UpdateInsuranceCaseInput, actorUserId: string) {
  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.insuranceArbitrationCase.findFirst({ where: { id, archivedAt: null }, select: { id: true, referenceNumber: true, version: true } });
    if (!existing) throw new InsuranceCaseNotFoundError();
    if (existing.version !== input.version) throw new InsuranceCaseVersionConflictError();
    const { payments, version, ...caseInput } = input;
    const updated = await transaction.insuranceArbitrationCase.updateMany({
      where: { id, version, archivedAt: null },
      data: { ...caseInput, accidentDate: parseDate(input.accidentDate)!, policyExpiryDate: parseDate(input.policyExpiryDate), postalDeliveryDate: parseDate(input.postalDeliveryDate), insuranceApplicationDate: parseDate(input.insuranceApplicationDate), arbitrationApplicationDate: input.hasArbitration ? parseDate(input.arbitrationApplicationDate) : null, arbitrationApplicationNo: input.hasArbitration ? input.arbitrationApplicationNo : null, arbitrationCaseNumber: input.hasArbitration ? input.arbitrationCaseNumber : null, updatedById: actorUserId, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new InsuranceCaseVersionConflictError();
    await transaction.insuranceArbitrationPayment.deleteMany({ where: { caseId: id } });
    if (payments.length > 0) {
      await transaction.insuranceArbitrationPayment.createMany({ data: payments.map((payment) => ({ caseId: id, type: payment.type, paymentDate: parseDate(payment.paymentDate)!, amount: payment.amount, commission: payment.commission, clientAmount: payment.amount.minus(payment.commission), description: payment.description })) });
    }
    await transaction.auditLog.create({ data: { actorUserId, event: "insurance_arbitration_case.updated", targetType: "insurance_arbitration_case", targetId: id, context: { referenceNumber: existing.referenceNumber, previousVersion: version, newVersion: version + 1 } } });
  });
  return getInsuranceCase(id);
}

function presentCase(record: InsuranceCaseRecord) {
  return { ...record, accidentDate: dateString(record.accidentDate), policyExpiryDate: dateString(record.policyExpiryDate), postalDeliveryDate: dateString(record.postalDeliveryDate), insuranceApplicationDate: dateString(record.insuranceApplicationDate), arbitrationApplicationDate: dateString(record.arbitrationApplicationDate), insuranceSettlementOffer: record.insuranceSettlementOffer.toFixed(2), postageExpense: record.postageExpense.toFixed(2), enforcementExpense: record.enforcementExpense.toFixed(2), arbitrationApplicationFee: record.arbitrationApplicationFee.toFixed(2), expertFee: record.expertFee.toFixed(2), postalAmount: record.postalAmount.toFixed(2), actualDepreciationAmount: record.actualDepreciationAmount.toFixed(2), payments: record.payments.map((payment) => ({ ...payment, paymentDate: dateString(payment.paymentDate), amount: payment.amount.toFixed(2), commission: payment.commission.toFixed(2), clientAmount: payment.clientAmount.toFixed(2) })), createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() };
}
function dateString(value: Date | null) { return value?.toISOString().slice(0, 10) ?? null; }
