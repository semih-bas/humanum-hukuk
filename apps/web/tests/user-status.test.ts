import assert from "node:assert/strict";
import test from "node:test";

import { validateUserStatusChange } from "../src/lib/user-status";

const baseInput = {
  actorUserId: "admin-1",
  targetUserId: "user-1",
  targetRole: "user",
  targetBanned: false,
  activeAdminCount: 1,
} as const;

test("yönetici kendi hesabını pasifleştiremez", () => {
  assert.equal(validateUserStatusChange({ ...baseInput, targetUserId: "admin-1", action: "ban" }), "Kendi hesabınızı pasifleştiremezsiniz.");
});

test("son aktif yönetici pasifleştirilemez", () => {
  assert.equal(validateUserStatusChange({ ...baseInput, targetRole: "admin", action: "ban" }), "Sistemdeki son aktif yönetici pasifleştirilemez.");
});

test("ikinci aktif yönetici pasifleştirilebilir", () => {
  assert.equal(validateUserStatusChange({ ...baseInput, targetRole: "admin", activeAdminCount: 2, action: "ban" }), null);
});

test("pasif kullanıcı tekrar aktifleştirilebilir", () => {
  assert.equal(validateUserStatusChange({ ...baseInput, targetBanned: true, action: "unban" }), null);
});