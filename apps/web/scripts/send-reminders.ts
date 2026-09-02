import { setTimeout } from "node:timers/promises";
import { processReminderBatch } from "../src/lib/reminder-delivery";
import { prisma } from "../src/lib/database";
import { validateEmailConfiguration } from "../src/lib/email";

if (process.env.REMINDER_EMAIL_ENABLED !== "true") {
  throw new Error("Reminder delivery is disabled. Set REMINDER_EMAIL_ENABLED=true after configuring and verifying the sender.");
}
validateEmailConfiguration();
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => controller.abort());
try {
  do {
    try {
      const result = await processReminderBatch();
      if (result.processed || result.interrupted) console.log("Reminder delivery batch", result);
    } catch (error) {
      console.error("Reminder worker failed", { error: error instanceof Error ? error.name : "UnknownError" });
      if (process.argv.includes("--once")) { process.exitCode = 1; break; }
    }
    if (process.argv.includes("--once") || controller.signal.aborted) break;
    await setTimeout(30_000, undefined, { signal: controller.signal }).catch(() => undefined);
  } while (!controller.signal.aborted);
} finally {
  await prisma.$disconnect();
}
