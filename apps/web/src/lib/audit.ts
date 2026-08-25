import { createHmac } from "node:crypto";

import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./database";
import { requireEnvironmentVariable } from "./environment";

type AuditEntry = {
  actorUserId?: string | null;
  event: string;
  targetType?: string | null;
  targetId?: string | null;
  context?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

function hashIpAddress(ipAddress?: string | null): string | null {
  if (!ipAddress) {
    return null;
  }

  return createHmac("sha256", requireEnvironmentVariable("BETTER_AUTH_SECRET"))
    .update(ipAddress)
    .digest("hex");
}

export async function tryWriteAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        event: entry.event,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        context: entry.context,
        ipAddressHash: hashIpAddress(entry.ipAddress),
      },
    });
  } catch (error) {
    console.error("Failed to write authentication audit log", {
      event: entry.event,
      targetType: entry.targetType,
      error: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
