import assert from "node:assert/strict";
import test from "node:test";

import { getLoginErrorNotice } from "../src/lib/login-error";

test("pasif hesap uyarısını doğrulama uyarısından ayırır", () => {
  const notice = getLoginErrorNotice({ code: "BANNED_USER", status: 403 });
  assert.equal(notice.kind, "error");
  assert.match(notice.message, /pasifleştirildi/i);
});

test("yalnızca doğrulanmamış hesap kodunda doğrulama mesajı gösterir", () => {
  const notice = getLoginErrorNotice({ code: "EMAIL_NOT_VERIFIED", status: 403 });
  assert.equal(notice.kind, "info");
  assert.match(notice.message, /doğrulanmadı/i);

  const unknownForbidden = getLoginErrorNotice({ code: "UNKNOWN", status: 403 });
  assert.doesNotMatch(unknownForbidden.message, /doğrulanmadı/i);
});

test("giriş deneme sınırı ve genel kimlik hatasını doğru gösterir", () => {
  assert.match(getLoginErrorNotice({ status: 429 }).message, /Çok fazla/i);
  assert.match(getLoginErrorNotice({ status: 401 }).message, /şifre hatalı/i);
});
