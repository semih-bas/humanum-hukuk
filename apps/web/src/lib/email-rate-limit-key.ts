import { createHmac } from "node:crypto";

import { requireEnvironmentVariable } from "./environment";

export type TransactionalEmailCategory = "password-reset" | "verification";

function subjectHash(subject: string): string {
  return createHmac("sha256", requireEnvironmentVariable("BETTER_AUTH_SECRET"))
    .update(subject.trim().toLowerCase())
    .digest("hex");
}

export function emailRateLimitKey(scope: string, category: TransactionalEmailCategory, subject: string, ruleName: string): string {
  return `email:${scope}:${category}:${ruleName}:${subjectHash(subject)}`;
}
