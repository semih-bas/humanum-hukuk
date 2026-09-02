export type DeliveryState = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "UNCERTAIN" | "CANCELLED";

export function eligibleReminderRecipient(user: { role: string | null; banned: boolean | null; emailVerified: boolean }): boolean {
  return user.role === "admin" && !user.banned && user.emailVerified;
}

export function aggregateReminderStatus(states: DeliveryState[]): "PENDING" | "PARTIALLY_SENT" | "SENT" | "FAILED" | "CANCELLED" {
  if (!states.length) return "PENDING";
  const relevant = states.filter((state) => state !== "CANCELLED");
  if (!relevant.length) return "CANCELLED";
  if (relevant.every((state) => state === "SENT")) return "SENT";
  if (relevant.some((state) => state === "SENT")) return "PARTIALLY_SENT";
  if (relevant.some((state) => state === "PENDING" || state === "PROCESSING")) return "PENDING";
  return "FAILED";
}

export function reminderFailureDecision(error: unknown, attempts: number): { status: "PENDING" | "FAILED" | "UNCERTAIN"; delayMs: number; code: string } {
  const smtp = (error && typeof error === "object" ? error : {}) as { code?: string; command?: string; responseCode?: number };
  const response = smtp.responseCode ?? 0;
  const connectionFailure = ["EDNS", "ECONNECTION"].includes(smtp.code ?? "") || ["CONN", "EHLO", "HELO", "STARTTLS"].includes(smtp.command ?? "");
  const permanent = smtp.code === "EAUTH" || smtp.command === "AUTH" || response >= 500 && response < 600 || smtp.code === "EENVELOPE" && !response;
  const transient = connectionFailure || response >= 400 && response < 500;
  if (permanent) return { status: "FAILED", delayMs: 0, code: "SMTP_REJECTED" };
  if (transient) return attempts < 3
    ? { status: "PENDING", delayMs: attempts * 5 * 60_000, code: "SMTP_RETRY" }
    : { status: "FAILED", delayMs: 0, code: "RETRY_EXHAUSTED" };
  // SMTP cannot provide exactly-once delivery. A lost DATA reply must not trigger a resend.
  return { status: "UNCERTAIN", delayMs: 0, code: "DELIVERY_UNCERTAIN" };
}

export function isAllowedReminderAddress(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (process.env.SMTP_HOST === "mailpit" && process.env.SMTP_PORT === "1025") return true;
  // Explicit allowlist until real sender testing / production approval is complete.
  const allowed = (process.env.REMINDER_ALLOWED_RECIPIENTS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  const domain = normalized.split("@")[1] ?? "";
  if (!domain || /(^|\.)(invalid|test|localhost|local)$/.test(domain)) return false;
  return allowed.includes(normalized);
}
