import assert from "node:assert/strict";
import test from "node:test";
import { DELETION_RETENTION_DAYS, deletionDueAt, validateUserDeletion } from "../src/lib/deletion-policy";

test("silinen kayıtlar için geri alma süresi 30 gündür", () => {
  const now = new Date("2026-09-23T12:00:00.000Z");
  assert.equal(DELETION_RETENTION_DAYS, 30);
  assert.equal(deletionDueAt(now).toISOString(), "2026-10-23T12:00:00.000Z");
});

test("kullanıcı silme pasifleştirme ve farklı yönetici gerektirir", () => {
  assert.match(validateUserDeletion({ actorUserId: "same", targetUserId: "same", targetBanned: true, alreadyScheduled: false })!, /Kendi/);
  assert.match(validateUserDeletion({ actorUserId: "admin", targetUserId: "user", targetBanned: false, alreadyScheduled: false })!, /pasifleştirilmelidir/);
  assert.equal(validateUserDeletion({ actorUserId: "admin", targetUserId: "user", targetBanned: true, alreadyScheduled: false }), null);
});
