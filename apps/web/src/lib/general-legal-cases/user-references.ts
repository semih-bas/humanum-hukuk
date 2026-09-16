import { prisma } from "@/lib/database";

import type { CreateGeneralLegalCaseInput, UpdateGeneralLegalCaseInput } from "./input";

export class GeneralLegalCaseUserReferenceError extends Error {}

export async function assertActiveGeneralCaseUserReference(userId: string | null) {
  if (!userId) return;
  const user = await prisma.user.findFirst({
    where: { id: userId, OR: [{ banned: false }, { banned: null }] },
    select: { id: true },
  });
  if (!user) throw new GeneralLegalCaseUserReferenceError();
}

export async function assertActiveGeneralCaseUserReferences(
  input: CreateGeneralLegalCaseInput | UpdateGeneralLegalCaseInput,
) {
  const identifiers = new Set<string>([input.responsibleUserId]);
  if (input.fileStaffUserId) identifiers.add(input.fileStaffUserId);
  for (const party of input.parties) {
    if (party.representativeUserId) identifiers.add(party.representativeUserId);
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...identifiers] }, OR: [{ banned: false }, { banned: null }] },
    select: { id: true },
  });
  if (users.length !== identifiers.size) throw new GeneralLegalCaseUserReferenceError();
}
