import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Client } from "pg";
import { buildDatabaseUrl } from "../src/lib/database-url";
import { emailRateLimitKey } from "../src/lib/email-rate-limit-key";

config({ path: [".env.acceptance.app", ".env.acceptance.database"], quiet: true });
if (process.env.REMINDER_CHECK_ALLOWED !== "true" || new URL(buildDatabaseUrl("app")).pathname !== "/humanum_hukuk_acceptance" || new URL(buildDatabaseUrl("migration")).pathname !== "/humanum_hukuk_acceptance" || process.env.SMTP_HOST !== "mailpit" || process.env.SMTP_PORT !== "1025") {
  throw new Error("Reminder checks require the isolated acceptance database, Mailpit and REMINDER_CHECK_ALLOWED=true. Stop app and worker first.");
}
const { prisma } = await import("../src/lib/database");
const { processReminderBatch } = await import("../src/lib/reminder-delivery");
const { addCaseReminder } = await import("../src/lib/cases/add-case-activity");
const { createCaseFile } = await import("../src/lib/cases/create-case");
const { createCaseSchema } = await import("../src/lib/cases/create-case-input");
const { ReminderCreationError } = await import("../src/lib/cases/reminder-creation-limit");
const { reserveTransactionalEmail, releaseFailedTransactionalEmail } = await import("../src/lib/email-rate-limit");
const mailpitHealth = await fetch("http://mailpit:8025/api/v1/messages", { signal: AbortSignal.timeout(5_000) });
if (!mailpitHealth.ok) throw new Error("Start the isolated Mailpit service before this check.");
const cleanup = new Client({ connectionString: buildDatabaseUrl("migration") });
await cleanup.connect();
const prefix = `reminder-check-${randomUUID()}`;
const userIds = ["user", "admin", "second", "inactive", "unverified"].map((name) => `${prefix}-${name}`);
const caseId = `${prefix}-case`;
const reminderIds: string[] = [];
const checks: string[] = [];
const globals = ["email:delivery:global:daily", "email:delivery:global:attempt-hourly", "email:delivery:reminder:daily", "email:delivery:reminder:attempt-hourly"];
const globalSnapshot = await prisma.emailRateLimit.findMany({ where: { key: { in: globals } } });
const now = new Date(Date.now() + 60_000);
let serial = 0;

async function reminder(prepared = false) {
  const id = `${prefix}-reminder-${serial++}`;
  reminderIds.push(id);
  await prisma.caseReminder.create({ data: { id, caseFileId: caseId, createdById: userIds[0], title: `Synthetic reminder ${serial}`, dueAt: now, nextPreparationAt: now, deliveryPreparedAt: prepared ? now : null, sendEmail: true, sendSms: false } });
  return id;
}
async function singleDelivery() {
  const id = await reminder(true);
  const delivery = await prisma.reminderDelivery.create({ data: { reminderId: id, recipientId: userIds[1], recipientEmail: `${userIds[1]}@example.invalid`, nextAttemptAt: now } });
  return { id, delivery };
}
async function state(id: string) { return prisma.caseReminder.findUniqueOrThrow({ where: { id }, include: { deliveries: true } }); }
const success = async () => ({ status: "sent" as const });

try {
  await prisma.user.createMany({ data: userIds.map((id, index) => ({ id, name: "Synthetic reminder test", email: `${id}@example.invalid`, role: index === 0 ? "user" : "admin", banned: index === 3, emailVerified: index !== 4 })) });
  await prisma.caseFile.create({ data: { id: caseId, referenceNumber: prefix, licenseHolder: "Synthetic Test", vehiclePlate: "34 TEST 001", accidentDate: new Date("2025-01-01"), debtorType: "INDIVIDUAL", createdById: userIds[0], updatedById: userIds[0] } });
  const input = { title: "Concurrent create", dueAt: now, sendEmail: true as const, sendSms: false as const };
  const creates = await Promise.all(Array.from({ length: 6 }, () => addCaseReminder(caseId, input, userIds[0])));
  const createdId = creates[0].id;
  reminderIds.push(createdId);
  assert.equal(new Set(creates.map((value) => value.id)).size, 1);
  checks.push("ordinary active users create reminders; concurrent duplicate requests create one record");

  const expectedAdmins = await prisma.user.findMany({ where: { role: "admin", emailVerified: true, OR: [{ banned: false }, { banned: null }] } });
  const recipients: string[] = [];
  await Promise.all(Array.from({ length: 3 }, () => processReminderBatch({ now, reminderIds: [createdId], send: async (mail) => { recipients.push(mail.to); return success(); } })));
  assert.deepEqual(recipients.sort(), expectedAdmins.map((admin) => admin.email).sort());
  assert.equal((await state(createdId)).status, "SENT");
  await processReminderBatch({ now, reminderIds: [createdId], send: async () => { throw new Error("duplicate send"); } });
  assert.equal((await state(createdId)).deliveries.every((delivery) => delivery.attempts === 1), true);
  checks.push("parallel workers send once per active verified admin, excluding regular/inactive/unverified users");

  const quota = await singleDelivery();
  await processReminderBatch({ now, reminderIds: [quota.id], send: async () => ({ status: "suppressed", retryAfterSeconds: 120 }) });
  assert.equal((await state(quota.id)).deliveries[0].attempts, 0);
  await processReminderBatch({ now, reminderIds: [quota.id], send: async () => { throw new Error("premature retry"); } });
  await processReminderBatch({ now: new Date(now.getTime() + 121_000), reminderIds: [quota.id], send: success });
  assert.equal((await state(quota.id)).status, "SENT");
  checks.push("quota exhaustion defers delivery without losing the reminder or consuming retry attempts");

  const retry = await singleDelivery();
  for (const offset of [0, 5 * 60_000, 15 * 60_000]) {
    await processReminderBatch({ now: new Date(now.getTime() + offset), reminderIds: [retry.id], send: async () => { throw Object.assign(new Error("synthetic"), { code: "ECONNECTION" }); } });
  }
  assert.equal((await state(retry.id)).status, "FAILED");
  assert.equal((await state(retry.id)).deliveries[0].attempts, 3);
  checks.push("known transient SMTP failure retries with backoff and stops after three attempts");

  const unknown = await singleDelivery();
  let unknownCalls = 0;
  const ambiguous = async () => { unknownCalls++; throw Object.assign(new Error("synthetic"), { code: "ETIMEDOUT", command: "DATA" }); };
  await processReminderBatch({ now, reminderIds: [unknown.id], send: ambiguous });
  await processReminderBatch({ now: new Date(now.getTime() + 86_400_000), reminderIds: [unknown.id], send: ambiguous });
  assert.equal(unknownCalls, 1);
  assert.equal((await state(unknown.id)).deliveries[0].status, "UNCERTAIN");
  checks.push("ambiguous SMTP acceptance never triggers an automatic duplicate");

  const stale = await singleDelivery();
  await prisma.reminderDelivery.update({ where: { id: stale.delivery.id }, data: { status: "PROCESSING", attempts: 1, startedAt: new Date(now.getTime() - 11 * 60_000) } });
  await processReminderBatch({ now, reminderIds: [stale.id], send: async () => { throw new Error("stale resend"); } });
  assert.equal((await state(stale.id)).deliveries[0].status, "UNCERTAIN");
  checks.push("interrupted worker claims are quarantined instead of replayed after restart");

  const disabled = await singleDelivery();
  await prisma.user.update({ where: { id: userIds[1] }, data: { banned: true } });
  await processReminderBatch({ now, reminderIds: [disabled.id], send: async () => { throw new Error("inactive send"); } });
  assert.equal((await state(disabled.id)).deliveries[0].status, "CANCELLED");
  await prisma.user.update({ where: { id: userIds[1] }, data: { banned: false } });
  checks.push("recipient eligibility is rechecked just before sending");

  const blocked = await reminder();
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.REMINDER_ALLOWED_RECIPIENTS = "";
  await processReminderBatch({ now, reminderIds: [blocked], send: async () => { throw new Error("unapproved send"); } });
  assert.equal((await state(blocked)).deliveries.length, 0);
  assert.equal((await state(blocked)).status, "PENDING");
  process.env.SMTP_HOST = "mailpit";
  checks.push("no eligible or approved recipient leaves reminders pending, without external delivery");

  // Actual SMTP only to our own synthetic recipient through Mailpit.
  await prisma.emailRateLimit.deleteMany({ where: { key: { in: globals } } });
  const smtp = await singleDelivery();
  await processReminderBatch({ now, reminderIds: [smtp.id] });
  assert.equal((await state(smtp.id)).status, "SENT");
  const mailbox = await fetch("http://mailpit:8025/api/v1/messages").then((response) => response.json()) as { messages: Array<{ ID: string; To: Array<{ Address: string }> }> };
  const mail = mailbox.messages.find((message) => message.To.some((recipient) => recipient.Address === `${userIds[1]}@example.invalid`));
  assert.ok(mail, "Mailpit must contain the actual delivered reminder");
  const message = await fetch(`http://mailpit:8025/api/v1/message/${mail.ID}`).then((response) => response.json()) as { HTML: string };
  assert.ok(message.HTML.includes(`/hatirlatmalar?reminder=${smtp.id}`));
  checks.push("actual SMTP delivery reaches Mailpit with the exact reminder link");

  const cap = Math.max(1, Math.floor(Number(process.env.EMAIL_DAILY_LIMIT ?? 300) * 0.8));
  await prisma.emailRateLimit.upsert({ where: { key: globals[2] }, create: { key: globals[2], count: cap, lastRequest: BigInt(Date.now()) }, update: { count: cap, lastRequest: BigInt(Date.now()) } });
  assert.equal((await reserveTransactionalEmail("reminder", `${userIds[2]}@example.invalid`)).allowed, false);
  assert.equal(await prisma.emailRateLimit.findUnique({ where: { key: emailRateLimitKey("delivery", "reminder", `${userIds[2]}@example.invalid`, "cooldown") } }), null);
  const authReservation = await reserveTransactionalEmail("verification", `${userIds[0]}@example.invalid`);
  assert.equal(authReservation.allowed, true);
  await releaseFailedTransactionalEmail(authReservation.releaseOnFailureKeys ?? []);
  checks.push("reminder quota exhaustion rolls back recipient counters and preserves capacity for authentication email");

  // Both creation entry points enforce the same limit, not just the modal endpoint.
  while (await prisma.caseReminder.count({ where: { createdById: userIds[0] } }) < 10) await reminder();
  await assert.rejects(addCaseReminder(caseId, { ...input, title: "Limit check" }, userIds[0]), (error: unknown) => error instanceof ReminderCreationError && error.status === 429);
  const caseInput = createCaseSchema.parse({ licenseHolder: "Synthetic limit", vehiclePlate: "34 TST 100", accidentDate: "2025-01-01", debtorType: "INDIVIDUAL", debtorName: "Synthetic", damageAmount: "0", depreciationAmount: "0", profitLossAmount: "0", discountAmount: "0", enforcementOffice: null, enforcementFileNumber: null, vehicleLien: false, bankLien: false, titleDeedLien: false, installmentCount: null, status: "OPEN", reminder: { ...input, dueAt: now.toISOString() } });
  await assert.rejects(createCaseFile(caseInput, userIds[0]), (error: unknown) => error instanceof ReminderCreationError && error.status === 429);
  await assert.rejects(addCaseReminder(caseId, input, userIds[3]), (error: unknown) => error instanceof ReminderCreationError && error.status === 403);
  checks.push("both nested and standalone reminder creation reject rate abuse; inactive creators are rejected");

  console.log(JSON.stringify({ status: "passed", checks }, null, 2));
} finally {
  // Only this run's identifiers are removed. Existing acceptance cases/users remain untouched.
  await cleanup.query("BEGIN");
  try {
    await cleanup.query('DELETE FROM "audit_log" WHERE "targetId" = ANY($1::text[]) OR "actorUserId" = ANY($2::text[])', [[caseId, ...reminderIds], userIds]);
    await cleanup.query('DELETE FROM "case_file" WHERE "id" = $1', [caseId]);
    await cleanup.query('DELETE FROM "user" WHERE "id" = ANY($1::text[])', [userIds]);
    const keys = userIds.flatMap((id) => (["reminder", "verification"] as const).flatMap((category) => ["cooldown", "hourly", "successful-daily"].map((rule) => emailRateLimitKey("delivery", category, `${id}@example.invalid`, rule))));
    await cleanup.query('DELETE FROM "email_rate_limit" WHERE "key" = ANY($1::text[])', [[...globals, ...keys]]);
    for (const row of globalSnapshot) await cleanup.query('INSERT INTO "email_rate_limit" ("key", "count", "lastRequest") VALUES ($1, $2, $3)', [row.key, row.count, row.lastRequest.toString()]);
    await cleanup.query("COMMIT");
  } catch (error) { await cleanup.query("ROLLBACK"); throw error; }
  finally { await cleanup.end(); await prisma.$disconnect(); }
}
