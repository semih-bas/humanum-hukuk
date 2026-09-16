import type { GeneralCaseKind } from "@/generated/prisma/client";

export function formatGeneralCaseReference(kind: GeneralCaseKind, sequence: bigint, now: Date) {
  const year = new Intl.DateTimeFormat("en", { timeZone: "Europe/Istanbul", year: "numeric" }).format(now);
  const prefix = kind === "MEDIATION" ? "ARB" : "GD";
  return `${prefix}-${year}-${sequence.toString().padStart(6, "0")}`;
}
