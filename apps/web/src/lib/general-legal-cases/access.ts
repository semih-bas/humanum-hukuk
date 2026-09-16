import type { Prisma } from "@/generated/prisma/client";
import type { UpdateGeneralLegalCaseInput } from "./input";

export type GeneralCaseActor = { id: string; role?: string | null };

export function generalCaseAccessWhere(actor: GeneralCaseActor): Prisma.GeneralLegalCaseWhereInput {
  if (actor.role === "admin") return {};
  return {
    OR: [
      { confidentiality: "NORMAL" },
      { createdById: actor.id },
      { responsibleUserId: actor.id },
      { fileStaffUserId: actor.id },
      { parties: { some: { representativeUserId: actor.id } } },
    ],
  };
}

export function canRetainRestrictedAccess(
  actor: GeneralCaseActor,
  createdById: string,
  input: {
    confidentiality: UpdateGeneralLegalCaseInput["confidentiality"];
    responsibleUserId: string;
    fileStaffUserId: string | null;
    parties: Array<{ representativeUserId: string | null }>;
  },
) {
  if (input.confidentiality !== "RESTRICTED" || actor.role === "admin" || createdById === actor.id) return true;
  return input.responsibleUserId === actor.id
    || input.fileStaffUserId === actor.id
    || input.parties.some((party) => party.representativeUserId === actor.id);
}
