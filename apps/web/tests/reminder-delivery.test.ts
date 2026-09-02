import assert from "node:assert/strict";
import test from "node:test";
import { buildReminderEmail } from "../src/lib/email";
import { aggregateReminderStatus, eligibleReminderRecipient, isAllowedReminderAddress, reminderFailureDecision } from "../src/lib/reminder-delivery-policy";

test("only active verified admins receive reminder email", () => {
  const active = { role: "admin", banned: false, emailVerified: true };
  assert.equal(eligibleReminderRecipient(active), true);
  assert.equal(eligibleReminderRecipient({ ...active, role: "user" }), false);
  assert.equal(eligibleReminderRecipient({ ...active, banned: true }), false);
  assert.equal(eligibleReminderRecipient({ ...active, emailVerified: false }), false);
  assert.equal(eligibleReminderRecipient({ ...active, role: null }), false);
});

test("delivery aggregation distinguishes partial, pending, failed and cancelled", () => {
  assert.equal(aggregateReminderStatus([]), "PENDING");
  assert.equal(aggregateReminderStatus(["SENT", "SENT"]), "SENT");
  assert.equal(aggregateReminderStatus(["SENT", "PENDING"]), "PARTIALLY_SENT");
  assert.equal(aggregateReminderStatus(["SENT", "UNCERTAIN"]), "PARTIALLY_SENT");
  assert.equal(aggregateReminderStatus(["FAILED", "PROCESSING"]), "PENDING");
  assert.equal(aggregateReminderStatus(["FAILED", "UNCERTAIN"]), "FAILED");
  assert.equal(aggregateReminderStatus(["CANCELLED"]), "CANCELLED");
  assert.equal(aggregateReminderStatus(["CANCELLED", "SENT"]), "SENT");
});

test("retry only definite transient rejection, at most three attempts", () => {
  assert.equal(reminderFailureDecision({ responseCode: 451 }, 1).status, "PENDING");
  assert.equal(reminderFailureDecision({ command: "CONN", code: "ETIMEDOUT" }, 1).delayMs, 300_000);
  assert.equal(reminderFailureDecision({ code: "ECONNECTION" }, 2).delayMs, 600_000);
  assert.equal(reminderFailureDecision({ responseCode: 451 }, 3).status, "FAILED");
  assert.equal(reminderFailureDecision({ responseCode: 550 }, 1).status, "FAILED");
  assert.equal(reminderFailureDecision({ code: "EAUTH" }, 1).status, "FAILED");
  assert.equal(reminderFailureDecision({ command: "DATA", code: "ETIMEDOUT" }, 1).status, "UNCERTAIN");
  assert.equal(reminderFailureDecision(new Error("unknown"), 1).status, "UNCERTAIN");
});

test("real SMTP requires an explicit allowlist and rejects synthetic domains", () => {
  const saved = { host: process.env.SMTP_HOST, port: process.env.SMTP_PORT, allowed: process.env.REMINDER_ALLOWED_RECIPIENTS };
  try {
    process.env.SMTP_HOST = "mailpit";
    process.env.SMTP_PORT = "1025";
    assert.equal(isAllowedReminderAddress("synthetic@example.invalid"), true);
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.REMINDER_ALLOWED_RECIPIENTS = " Approved@example.com, synthetic@example.invalid ";
    assert.equal(isAllowedReminderAddress("approved@example.com"), true);
    assert.equal(isAllowedReminderAddress("other@example.com"), false);
    assert.equal(isAllowedReminderAddress("synthetic@example.invalid"), false);
  } finally {
    for (const [key, value] of Object.entries({ SMTP_HOST: saved.host, SMTP_PORT: saved.port, REMINDER_ALLOWED_RECIPIENTS: saved.allowed })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("reminder email escapes user content and links to the exact reminder", () => {
  const saved = process.env.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_URL = "http://localhost:3001";
  try {
    const content = buildReminderEmail({ to: "admin@example.invalid", recipientName: "<script>", title: "<img src=x onerror=alert(1)>", referenceNumber: "HH-TEST", dueAt: new Date("2026-09-02T09:00:00Z"), reminderId: "safe-id" });
    assert.ok(content.html.includes("&lt;script&gt;"));
    assert.ok(!content.html.includes("<img"));
    assert.ok(content.html.includes("/hatirlatmalar?reminder=safe-id#reminder-safe-id"));
    assert.ok(content.text.includes("12:00"));
    assert.ok(content.text.includes("yöneticilere"));
  } finally { if (saved === undefined) delete process.env.BETTER_AUTH_URL; else process.env.BETTER_AUTH_URL = saved; }
});
