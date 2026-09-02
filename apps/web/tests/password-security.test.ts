import assert from "node:assert/strict";
import test from "node:test";

import { buildEmailVerificationEmail, buildPasswordResetEmail, isDefiniteEmailRejection } from "../src/lib/email";
import { emailRateLimitKey } from "../src/lib/email-rate-limit-key";
import { clearSensitiveActionAttempts, consumeSensitiveActionAttempt } from "../src/lib/sensitive-action-rate-limit";

test("şifre yenileme e-postası güvenli bağlantı ve süre bilgisini içerir", () => {
  const resetUrl = "https://hukuk.example.com/api/auth/reset-password/token?callbackURL=%2Fsifre-sifirla";
  const email = buildPasswordResetEmail({ recipientName: "Semih Baş", resetUrl });

  assert.match(email.subject, /şifre yenileme/i);
  assert.match(email.text, /30 dakika/);
  assert.match(email.text, /yalnızca bir kez/);
  assert.match(email.text, new RegExp(resetUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("e-posta HTML içeriği kullanıcı adını ve bağlantıyı escape eder", () => {
  const email = buildPasswordResetEmail({
    recipientName: "<script>alert('x')</script>",
    resetUrl: "https://example.com/reset?token=abc&next=<script>",
  });

  assert.doesNotMatch(email.html, /<script>alert/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /token=abc&amp;next=&lt;script&gt;/);
});

test("e-posta doğrulama iletisi güvenli bağlantı ve süre bilgisini içerir", () => {
  const verificationUrl = "https://hukuk.example.com/api/auth/verify-email?token=abc&callbackURL=%2Flogin";
  const email = buildEmailVerificationEmail({ recipientName: "Semih Baş", verificationUrl });

  assert.match(email.subject, /doğrulayın/i);
  assert.match(email.text, /30 dakika/);
  assert.match(email.text, /yönetici tarafından oluşturuldu/i);
  assert.match(email.html, /token=abc&amp;callbackURL/);
});

test("hassas işlem deneme sınırı aşılınca isteği reddeder ve temizlenebilir", () => {
  const key = `test-${Date.now()}-${Math.random()}`;
  const options = { max: 2, windowMs: 60_000 };

  assert.equal(consumeSensitiveActionAttempt(key, options).allowed, true);
  assert.equal(consumeSensitiveActionAttempt(key, options).allowed, true);
  const blocked = consumeSensitiveActionAttempt(key, options);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);

  clearSensitiveActionAttempts(key);
  assert.equal(consumeSensitiveActionAttempt(key, options).allowed, true);
  clearSensitiveActionAttempts(key);
});

test("e-posta hız sınırı anahtarı adresi açık metin olarak saklamaz", () => {
  process.env.BETTER_AUTH_SECRET ??= "test-only-secret-at-least-32-characters";
  const first = emailRateLimitKey("request", "password-reset", "User@Example.com", "daily");
  const normalized = emailRateLimitKey("request", "password-reset", " user@example.com ", "daily");
  const otherPurpose = emailRateLimitKey("request", "verification", "user@example.com", "daily");

  assert.equal(first, normalized);
  assert.notEqual(first, otherPurpose);
  assert.doesNotMatch(first, /user@example\.com/i);
});

test("belirsiz SMTP sonuçları günlük kotadan düşülmez", () => {
  assert.equal(isDefiniteEmailRejection({ code: "ESOCKET", command: "CONN" }), true);
  assert.equal(isDefiniteEmailRejection({ responseCode: 550, command: "DATA" }), true);
  assert.equal(isDefiniteEmailRejection({ code: "ETIMEDOUT", command: "DATA" }), false);
  assert.equal(isDefiniteEmailRejection(new Error("Unknown provider failure")), false);
});
