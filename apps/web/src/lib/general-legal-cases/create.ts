import { prisma } from "@/lib/database";

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
    const { parties, ...caseInput } = input;
    const record = await transaction.generalLegalCase.create({
      data: {
        ...caseInput,
        referenceNumber,
        openingDate: parseDateOnly(input.openingDate)!,
        estimatedCompletionDate: parseDateOnly(input.estimatedCompletionDate),
        parties: { create: partyCreateData(parties) },
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
        context: { referenceNumber, kind: input.kind, confidentiality: input.confidentiality },
      },
    });
    return record;
  });
}

function partyCreateData(parties: GeneralCasePartyInput[]) {
  return parties.map((party, index) => ({ ...party, sortOrder: index }));
}
