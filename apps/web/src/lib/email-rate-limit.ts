import type { Prisma } from "../generated/prisma/client";
import { emailRateLimitKey, type TransactionalEmailCategory } from "./email-rate-limit-key";

export { emailRateLimitKey, type TransactionalEmailCategory } from "./email-rate-limit-key";

type RateLimitRule = {
  max: number;
  name: string;
  windowMs: number;
};

export type EmailRateLimitDecision = {
  allowed: boolean;
  releaseOnFailureKeys?: string[];
  retryAfterSeconds: number;
};

type RateLimitItem = {
  key: string;
  releaseOnFailure?: boolean;
  rule: RateLimitRule;
};

class EmailRateLimitExceeded extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Email rate limit exceeded");
  }
}

const requestRules: RateLimitRule[] = [
  { name: "cooldown", max: 1, windowMs: 60_000 },
  { name: "burst", max: 3, windowMs: 15 * 60_000 },
  { name: "daily", max: 10, windowMs: 24 * 60 * 60_000 },
];

const deliveryRecipientRules: RateLimitRule[] = [
  { name: "cooldown", max: 1, windowMs: 60_000 },
  { name: "hourly", max: 3, windowMs: 60 * 60_000 },
];

const recipientSuccessfulDeliveryRule: RateLimitRule = { name: "successful-daily", max: 5, windowMs: 24 * 60 * 60_000 };
const globalAttemptRule: RateLimitRule = { name: "attempt-hourly", max: 50, windowMs: 60 * 60_000 };

let nextPruneAt = 0;

function globalDeliveryRule(): RateLimitRule {
  const configured = process.env.EMAIL_DAILY_LIMIT?.trim();
  const max = configured ? Number(configured) : 300;
  if (!Number.isInteger(max) || max < 1 || max > 10_000) {
    throw new Error("EMAIL_DAILY_LIMIT must be an integer between 1 and 10000.");
  }
  return { name: "daily", max, windowMs: 24 * 60 * 60_000 };
}

async function consumeRule(database: Prisma.TransactionClient, key: string, rule: RateLimitRule): Promise<EmailRateLimitDecision> {
  const now = Date.now();
  const windowStart = now - rule.windowMs;
  const consumed = await database.$queryRaw<Array<{ count: number; lastRequest: bigint }>>`
    INSERT INTO "email_rate_limit" ("key", "count", "lastRequest")
    VALUES (${key}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE
    SET
      "count" = CASE
        WHEN "email_rate_limit"."lastRequest" <= ${BigInt(windowStart)} THEN 1
        ELSE "email_rate_limit"."count" + 1
      END,
      "lastRequest" = ${BigInt(now)}
    WHERE
      "email_rate_limit"."lastRequest" <= ${BigInt(windowStart)}
      OR "email_rate_limit"."count" < ${rule.max}
    RETURNING "count", "lastRequest"
  `;
  if (consumed.length === 1) return { allowed: true, retryAfterSeconds: 0 };

  const [fresh] = await database.$queryRaw<Array<{ lastRequest: bigint }>>`
    SELECT "lastRequest" FROM "email_rate_limit" WHERE "key" = ${key}
  `;
  if (!fresh || Number(fresh.lastRequest) <= windowStart) return consumeRule(database, key, rule);
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((Number(fresh.lastRequest) + rule.windowMs - now) / 1_000)),
  };
}

async function consumeRules(items: RateLimitItem[]): Promise<EmailRateLimitDecision> {
  const { prisma } = await import("./database");
  try {
    const releaseOnFailureKeys = await prisma.$transaction(async (transaction) => {
      const releasable: string[] = [];
      for (const item of items) {
        const decision = await consumeRule(transaction, item.key, item.rule);
        if (!decision.allowed) throw new EmailRateLimitExceeded(decision.retryAfterSeconds);
        if (item.releaseOnFailure) releasable.push(item.key);
      }
      return releasable;
    });
    void pruneExpiredRows();
    return { allowed: true, retryAfterSeconds: 0, releaseOnFailureKeys };
  } catch (error) {
    if (error instanceof EmailRateLimitExceeded) {
      return { allowed: false, retryAfterSeconds: error.retryAfterSeconds };
    }
    throw error;
  }
}

async function pruneExpiredRows(): Promise<void> {
  const now = Date.now();
  if (now < nextPruneAt) return;
  nextPruneAt = now + 15 * 60_000;
  try {
    const { prisma } = await import("./database");
    await prisma.$executeRaw`
      DELETE FROM "email_rate_limit" WHERE "lastRequest" < ${BigInt(now - 48 * 60 * 60_000)}
    `;
  } catch (error) {
    console.error("Failed to prune email rate limits", { error: error instanceof Error ? error.name : "UnknownError" });
  }
}

export async function consumeAuthEmailRequest(category: TransactionalEmailCategory, email: string): Promise<EmailRateLimitDecision> {
  return consumeRules(requestRules.map((rule) => ({
    key: emailRateLimitKey("request", category, email, rule.name),
    rule,
  })));
}

export async function reserveTransactionalEmail(category: TransactionalEmailCategory, recipient: string): Promise<EmailRateLimitDecision> {
  const reminder = category === "reminder";
  const recipientRules = reminder ? [
    { name: "cooldown", max: 1, windowMs: 60_000 },
    { name: "hourly", max: 20, windowMs: 60 * 60_000 },
  ] : deliveryRecipientRules;
  const successfulRule = reminder ? { ...recipientSuccessfulDeliveryRule, max: 100 } : recipientSuccessfulDeliveryRule;
  const recipientAttemptRules = recipientRules.map((rule) => ({
    key: emailRateLimitKey("delivery", category, recipient, rule.name),
    rule,
  }));
  const globalRuleDefinition = globalDeliveryRule();
  if (reminder && globalRuleDefinition.max < 2) return { allowed: false, retryAfterSeconds: 86_400 };
  const successRules: RateLimitItem[] = [{
    key: emailRateLimitKey("delivery", category, recipient, successfulRule.name),
    rule: successfulRule,
    releaseOnFailure: true,
  }, {
    key: `email:delivery:global:${globalRuleDefinition.name}`,
    rule: globalRuleDefinition,
    releaseOnFailure: true,
  }];
  return consumeRules([
    ...recipientAttemptRules,
    // Leave capacity for verification and password recovery, even under a reminder flood.
    ...(reminder ? [{ key: "email:delivery:reminder:attempt-hourly", rule: { ...globalAttemptRule, max: 40 } },
      { key: "email:delivery:reminder:daily", rule: { ...globalRuleDefinition, max: Math.max(1, Math.floor(globalRuleDefinition.max * 0.8)) }, releaseOnFailure: true }] : []),
    { key: `email:delivery:global:${globalAttemptRule.name}`, rule: globalAttemptRule },
    ...successRules,
  ]);
}

export async function releaseFailedTransactionalEmail(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const { prisma } = await import("./database");
  await prisma.$transaction(async (transaction) => {
    for (const key of keys) {
      await transaction.$executeRaw`
        UPDATE "email_rate_limit"
        SET "count" = GREATEST("count" - 1, 0)
        WHERE "key" = ${key}
      `;
    }
  });
}
