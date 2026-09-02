import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";

import { buildDatabaseUrl } from "../src/lib/database-url";
import { emailRateLimitKey } from "../src/lib/email-rate-limit-key";

config({ path: [".env.acceptance.app", ".env.acceptance.database"], quiet: true });
if (process.env.EMAIL_SECURITY_CHECK_ALLOWED !== "true" ||
    new URL(buildDatabaseUrl("app")).pathname !== "/humanum_hukuk_acceptance") {
  throw new Error("This check requires explicit approval and the isolated acceptance database. Stop the acceptance app first.");
}

const { prisma } = await import("../src/lib/database");
const { consumeAuthEmailRequest, reserveTransactionalEmail, releaseFailedTransactionalEmail } = await import("../src/lib/email-rate-limit");
const { sendPasswordResetEmail } = await import("../src/lib/email");
const globalKeys = ["email:delivery:global:daily", "email:delivery:global:attempt-hourly"];
const testKeys = new Set<string>();
const globalSnapshot: Array<{ key: string; count: number; lastRequest: bigint }> = [];
let globalsModified = false;
const runId = randomUUID();
const checks: string[] = [];

function recipient(name: string): string {
  const email = `email-security-${runId}-${name}@example.invalid`;
  for (const category of ["password-reset", "verification"] as const) {
    for (const rule of ["cooldown", "burst", "daily"]) testKeys.add(emailRateLimitKey("request", category, email, rule));
    for (const rule of ["cooldown", "hourly", "successful-daily"]) testKeys.add(emailRateLimitKey("delivery", category, email, rule));
  }
  return email;
}

async function read(key: string) {
  const rows = await prisma.$queryRaw<Array<{ key: string; count: number; lastRequest: bigint }>>`
    SELECT "key", "count", "lastRequest" FROM "email_rate_limit" WHERE "key" = ${key}
  `;
  return rows[0];
}

async function put(key: string, count: number, lastRequest = BigInt(Date.now())) {
  await prisma.$executeRaw`
    INSERT INTO "email_rate_limit" ("key", "count", "lastRequest") VALUES (${key}, ${count}, ${lastRequest})
    ON CONFLICT ("key") DO UPDATE SET "count" = EXCLUDED."count", "lastRequest" = EXCLUDED."lastRequest"
  `;
}

try {
  for (const key of globalKeys) {
    const row = await read(key);
    if (row) globalSnapshot.push(row);
  }
  globalsModified = true;
  for (const key of globalKeys) await prisma.$executeRaw`DELETE FROM "email_rate_limit" WHERE "key" = ${key}`;
  process.env.EMAIL_DAILY_LIMIT = "2";

  const concurrentEmail = recipient("concurrent");
  const decisions = await Promise.all(Array.from({ length: 12 }, (_, index) =>
    consumeAuthEmailRequest("password-reset", index % 2 ? concurrentEmail.toUpperCase() : ` ${concurrentEmail} `)));
  assert.equal(decisions.filter((decision) => decision.allowed).length, 1);
  assert.equal((await read(emailRateLimitKey("request", "password-reset", concurrentEmail, "burst")))?.count, 1);
  checks.push("concurrent and differently cased requests consume one allowance");

  const poisonedEmail = recipient("poisoned");
  const blockedBurst = emailRateLimitKey("request", "password-reset", poisonedEmail, "burst");
  await put(blockedBurst, 3);
  const before = await read(blockedBurst);
  assert.equal((await consumeAuthEmailRequest("password-reset", poisonedEmail)).allowed, false);
  assert.equal(await read(emailRateLimitKey("request", "password-reset", poisonedEmail, "cooldown")), undefined);
  assert.deepEqual(await read(blockedBurst), before);
  checks.push("denied long-window requests cannot poison shorter cooldowns");

  const cappedEmail = recipient("global-cap");
  await put(globalKeys[0], 2);
  assert.equal((await reserveTransactionalEmail("verification", cappedEmail)).allowed, false);
  assert.equal(await read(emailRateLimitKey("delivery", "verification", cappedEmail, "cooldown")), undefined);
  assert.equal(await read(globalKeys[1]), undefined);
  checks.push("global quota rejection rolls back every recipient and attempt counter");
  await prisma.$executeRaw`DELETE FROM "email_rate_limit" WHERE "key" = ${globalKeys[0]}`;

  const releasedEmail = recipient("release");
  const reserved = await reserveTransactionalEmail("verification", releasedEmail);
  assert.equal(reserved.allowed, true);
  assert.equal((await reserveTransactionalEmail("verification", releasedEmail)).allowed, false);
  await releaseFailedTransactionalEmail(reserved.releaseOnFailureKeys ?? []);
  assert.equal((await read(globalKeys[0]))?.count, 0);
  assert.equal((await read(emailRateLimitKey("delivery", "verification", releasedEmail, "successful-daily")))?.count, 0);
  assert.equal((await read(emailRateLimitKey("delivery", "verification", releasedEmail, "hourly")))?.count, 1);
  checks.push("failed deliveries release daily quota but retain short attempt protection");

  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = "1";
  process.env.SMTP_FROM = "Humanum Security Test <no-reply@example.invalid>";
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_REQUIRE_TLS = "false";
  delete process.env.SMTP_USERNAME;
  delete process.env.SMTP_PASSWORD;
  const failedEmail = recipient("smtp-failure");
  await assert.rejects(sendPasswordResetEmail({ to: failedEmail, recipientName: "Synthetic Test", resetUrl: "http://localhost:3001/sifre-sifirla" }));
  assert.equal((await read(globalKeys[0]))?.count, 0);
  assert.equal((await read(emailRateLimitKey("delivery", "password-reset", failedEmail, "successful-daily")))?.count, 0);
  assert.equal((await read(emailRateLimitKey("delivery", "password-reset", failedEmail, "hourly")))?.count, 1);
  checks.push("actual connection-refused SMTP failures do not exhaust daily delivery quota");

  console.log(JSON.stringify({ status: "passed", checks }, null, 2));
} finally {
  await prisma.$transaction(async (transaction) => {
    for (const key of testKeys) await transaction.$executeRaw`DELETE FROM "email_rate_limit" WHERE "key" = ${key}`;
    if (globalsModified) {
      for (const key of globalKeys) await transaction.$executeRaw`DELETE FROM "email_rate_limit" WHERE "key" = ${key}`;
      for (const row of globalSnapshot) {
        await transaction.$executeRaw`
          INSERT INTO "email_rate_limit" ("key", "count", "lastRequest") VALUES (${row.key}, ${row.count}, ${row.lastRequest})
        `;
      }
    }
  });
  await prisma.$disconnect();
}
