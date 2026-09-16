import type { Prisma } from "@/generated/prisma/client";

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
