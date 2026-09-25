import assert from "node:assert/strict";
import test from "node:test";
import { notificationLeadMinutes, notificationTime } from "../src/lib/notification-schedule";

test("bildirim önceliği hatırlatma zamanını erkene çeker", () => {
  const eventAt = new Date("2026-10-10T10:00:00.000Z");
  assert.equal(notificationLeadMinutes("HIGH"), 4320);
  assert.equal(notificationLeadMinutes("MEDIUM"), 2880);
  assert.equal(notificationLeadMinutes("LOW"), 180);
  assert.equal(notificationTime(eventAt, "HIGH").toISOString(), "2026-10-07T10:00:00.000Z");
  assert.equal(notificationTime(eventAt, "MEDIUM").toISOString(), "2026-10-08T10:00:00.000Z");
  assert.equal(notificationTime(eventAt, "LOW").toISOString(), "2026-10-10T07:00:00.000Z");
});
