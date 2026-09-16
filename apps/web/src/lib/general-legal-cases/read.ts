import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database";

import { generalCaseAccessWhere, type GeneralCaseActor } from "./access";

export class GeneralLegalCaseNotFoundError extends Error {}

const include = {
  responsibleUser: { select: { id: true, name: true } },
  fileStaffUser: { select: { id: true, name: true } },
  parties: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    include: { representativeUser: { select: { id: true, name: true } } },
  },
};

type GeneralCaseRecord = Prisma.GeneralLegalCaseGetPayload<{ include: typeof include }>;

export async function getGeneralLegalCase(id: string, actor: GeneralCaseActor) {
  const record = await prisma.generalLegalCase.findFirst({
    where: { id, archivedAt: null, ...generalCaseAccessWhere(actor) },
    include,
  });
  if (!record) throw new GeneralLegalCaseNotFoundError();
  return presentGeneralLegalCase(record);
}

function presentGeneralLegalCase(record: GeneralCaseRecord) {
  return {
    ...record,
    caseValue: record.caseValue.toFixed(2),
    openingDate: dateString(record.openingDate),
    estimatedCompletionDate: dateString(record.estimatedCompletionDate),
    archivedAt: record.archivedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    parties: record.parties.map((party) => ({
      ...party,
      createdAt: party.createdAt.toISOString(),
      updatedAt: party.updatedAt.toISOString(),
    })),
  };
}

function dateString(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}
