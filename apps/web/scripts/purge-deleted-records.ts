import { setTimeout } from "node:timers/promises";
import { purgeExpiredDeletions } from "../src/lib/deletion-cleanup";
import { prisma } from "../src/lib/database";

const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => controller.abort());
try {
  do {
    try { const result = await purgeExpiredDeletions(); if (Object.values(result).some(Boolean)) console.log("Expired deletion cleanup", result); }
    catch (error) { console.error("Deletion cleanup failed", { error: error instanceof Error ? error.name : "UnknownError" }); if (process.argv.includes("--once")) process.exitCode = 1; }
    if (process.argv.includes("--once") || controller.signal.aborted) break;
    await setTimeout(6 * 60 * 60 * 1000, undefined, { signal: controller.signal }).catch(() => undefined);
  } while (!controller.signal.aborted);
} finally { await prisma.$disconnect(); }
