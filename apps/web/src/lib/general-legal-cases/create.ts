import { prisma } from "@/lib/database";

import { calculateGeneralCaseFinanceTotals } from "./finance-calculations";
import type { CreateGeneralLegalCaseInput, GeneralCasePartyInput } from "./input";
import { parseDateOnly } from "./input";
import { formatGeneralCaseReference } from "./reference";
import { assertActiveGeneralCaseUserReferences } from "./user-references";

export async function createGeneralLegalCase(input: CreateGeneralLegalCaseInput, actorUserId: string) {
  await assertActiveGeneralCaseUserReferences(input);

  return prisma.$transaction(async (transaction) => {
    const [sequence] = await transaction.$queryRaw<Array<{ value: bigint }>>`
      SELECT nextval('general_legal_case_reference_sequence') AS value
    `;
    if (!sequence) throw new Error("General legal case reference sequence unavailable.");

    const referenceNumber = formatGeneralCaseReference(input.kind, sequence.value, new Date());
    const { parties, finance, financialEntries, processEntries, hearings, tasks, ...caseInput } = input;
    const totals = finance ? calculateGeneralCaseFinanceTotals(
      decimalToCents(finance.expectedCollectionAmount),
      financialEntries.map((entry) => ({ type: entry.type, amountCents: decimalToCents(entry.amount) })),
    ) : null;
    const record = await transaction.generalLegalCase.create({
      data: {
        ...caseInput,
        ...(finance ? {
          claimAmount: finance.claimAmount,
          amendmentAmount: finance.amendmentAmount,
          interestRequested: finance.interestRequested,
          interestStartDate: parseDateOnly(finance.interestStartDate),
          expectedCollectionAmount: finance.expectedCollectionAmount,
          opposingAttorneyFee: finance.opposingAttorneyFee,
          collectionStatus: collectionStatus(decimalToCents(finance.expectedCollectionAmount), totals!.collectionCents),
          paymentPlan: finance.paymentPlan,
          installmentCount: finance.installmentCount,
          financeDescription: finance.financeDescription,
        } : {}),
        referenceNumber,
        openingDate: parseDateOnly(input.openingDate)!,
        estimatedCompletionDate: parseDateOnly(input.estimatedCompletionDate),
        parties: { create: partyCreateData(parties) },
        ...(financialEntries.length ? { financialEntries: {
          create: financialEntries.map((entry) => ({
            type: entry.type,
            category: entry.category,
            entryDate: parseDateOnly(entry.entryDate)!,
            amount: entry.amount,
            description: entry.description,
            createdById: actorUserId,
            updatedById: actorUserId,
          })),
        } } : {}),
        ...(processEntries.length ? { processEntries: { create: processEntries.map((entry) => ({
          type: entry.type, stage: entry.stage, eventDate: parseDateOnly(entry.eventDate)!, action: entry.action,
          description: entry.description, responsibleUserId: entry.responsibleUserId, createdById: actorUserId, updatedById: actorUserId,
        })) } } : {}),
        ...(hearings.length ? { hearings: { create: hearings.map((hearing) => ({
          ...hearing, createdById: actorUserId, updatedById: actorUserId,
        })) } } : {}),
        ...(tasks.length ? { tasks: { create: tasks.map((task) => ({
          ...task, createdById: actorUserId, updatedById: actorUserId,
        })) } } : {}),
        createdById: actorUserId,
        updatedById: actorUserId,
      },
      select: { id: true, referenceNumber: true },
    });
    await transaction.auditLog.create({
      data: {
        actorUserId,
        event: "general_legal_case.created",
        targetType: "general_legal_case",
        targetId: record.id,
        context: { referenceNumber, kind: input.kind, confidentiality: input.confidentiality, initialFinancialEntryCount: financialEntries.length, initialProcessEntryCount: processEntries.length, initialHearingCount: hearings.length, initialTaskCount: tasks.length },
      },
    });
    return record;
  });
}

function decimalToCents(value: { toFixed(digits: number): string }) {
  return BigInt(value.toFixed(2).replace(".", ""));
}

function collectionStatus(expectedCents: bigint, collectedCents: bigint) {
  if (collectedCents <= 0n) return "NOT_COLLECTED" as const;
  if (expectedCents <= 0n || collectedCents >= expectedCents) return "COLLECTED" as const;
  return "PARTIAL" as const;
}

function partyCreateData(parties: GeneralCasePartyInput[]) {
  return parties.map((party, index) => ({ ...party, sortOrder: index }));
}
