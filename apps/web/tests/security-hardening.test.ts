import assert from "node:assert/strict";
import test from "node:test";

import { assertDocumentQuota, DocumentQuotaExceededError, documentStorageLimits } from "../src/lib/document-limits";
import { hasExpectedDocumentDigest } from "../src/lib/document-integrity";
import { buildDatabaseUrl } from "../src/lib/database-url";
import { requireHttpUrl } from "../src/lib/environment";
import { validateEmailConfiguration } from "../src/lib/email";
import { adminUserCreationContainsPassword, buildNewUserEnrollment } from "../src/lib/new-user-enrollment";

function withEnvironment(values: Record<string, string | undefined>, callback: () => void) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { callback(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("administrator enrollment never contains a password", () => {
  const enrollment = buildNewUserEnrollment({ name: "  Yeni Kullanıcı ", email: " USER@EXAMPLE.COM " });
  assert.deepEqual(enrollment.account, { name: "Yeni Kullanıcı", email: "user@example.com" });
  assert.equal(Object.hasOwn(enrollment.account, "password"), false);
  assert.deepEqual(enrollment.verification, { email: "user@example.com", callbackURL: "/sifremi-unuttum" });
  assert.equal(adminUserCreationContainsPassword({ email: "user@example.com", password: "secret" }), true);
  assert.equal(adminUserCreationContainsPassword({ email: "user@example.com" }), false);
});

test("same-length document tampering fails SHA-256 verification", () => {
  const original = Buffer.from("same-size-a");
  const replacement = Buffer.from("same-size-b");
  const digest = "5569339403fbe133398d2b3b38520b6e68c639b7e10d3ed7570395be683dda90";
  assert.equal(hasExpectedDocumentDigest(original, digest), true);
  assert.equal(hasExpectedDocumentDigest(replacement, digest), false);
});

test("document quotas reject per-case and aggregate overflow", () => {
  const limits = { maxDocumentsPerCase: 2, maxStorageBytes: 100, maxUploadsPerUserHour: 3 };
  assert.doesNotThrow(() => assertDocumentQuota({ caseDocumentCount: 1, storedBytes: 60 }, 40, limits));
  assert.throws(() => assertDocumentQuota({ caseDocumentCount: 2, storedBytes: 0 }, 1, limits),
    (error) => error instanceof DocumentQuotaExceededError && error.code === "CASE_DOCUMENT_LIMIT");
  assert.throws(() => assertDocumentQuota({ caseDocumentCount: 0, storedBytes: 61 }, 40, limits),
    (error) => error instanceof DocumentQuotaExceededError && error.code === "STORAGE_QUOTA_EXCEEDED");
});

test("document limit configuration rejects unsafe values", () => {
  withEnvironment({ DOCUMENT_MAX_PER_CASE: "0" }, () => assert.throws(documentStorageLimits));
  withEnvironment({ DOCUMENT_MAX_PER_CASE: "25", DOCUMENT_STORAGE_QUOTA_BYTES: "1000", DOCUMENT_UPLOADS_PER_USER_HOUR: "5" }, () => {
    assert.deepEqual(documentStorageLimits(), { maxDocumentsPerCase: 25, maxStorageBytes: 1000, maxUploadsPerUserHour: 5 });
  });
});

test("production public origins require HTTPS except loopback acceptance", () => {
  withEnvironment({ NODE_ENV: "production", BETTER_AUTH_URL: "https://hukuk.example.com" }, () => assert.equal(requireHttpUrl("BETTER_AUTH_URL"), "https://hukuk.example.com"));
  withEnvironment({ NODE_ENV: "production", BETTER_AUTH_URL: "http://localhost:3001" }, () => assert.equal(requireHttpUrl("BETTER_AUTH_URL"), "http://localhost:3001"));
  withEnvironment({ NODE_ENV: "production", BETTER_AUTH_URL: "http://hukuk.example.com" }, () => assert.throws(() => requireHttpUrl("BETTER_AUTH_URL"), /HTTPS/));
});

test("external production databases require verified TLS", () => {
  withEnvironment({ NODE_ENV: "production", DATABASE_URL: "postgresql://user:pass@database:5432/app" }, () => assert.doesNotThrow(() => buildDatabaseUrl("app")));
  withEnvironment({ NODE_ENV: "production", DATABASE_URL: "postgresql://user:pass@db.example.com:5432/app" }, () => assert.throws(() => buildDatabaseUrl("app"), /sslmode=verify-full/));
  withEnvironment({ NODE_ENV: "production", DATABASE_URL: "postgresql://user:pass@db.example.com:5432/app?sslmode=verify-full" }, () => assert.doesNotThrow(() => buildDatabaseUrl("app")));
  withEnvironment({ NODE_ENV: "production", DATABASE_URL: "postgresql://user:pass@database:5432/app?host=db.example.com&sslmode=disable" }, () => assert.throws(() => buildDatabaseUrl("app"), /must not override/));
  withEnvironment({ NODE_ENV: "production", DATABASE_URL: "postgresql://user:pass@db.example.com:5432/app?sslmode=verify-full&sslmode=disable" }, () => assert.throws(() => buildDatabaseUrl("app"), /at most one sslmode/));
});

test("production SMTP rejects cleartext external delivery and permits local Mailpit", () => {
  const base = { NODE_ENV: "production", SMTP_PORT: "1025", SMTP_FROM: "Humanum <no-reply@humanum.local>", SMTP_USERNAME: undefined, SMTP_PASSWORD: undefined, SMTP_SECURE: "false", SMTP_REQUIRE_TLS: "false" };
  withEnvironment({ ...base, SMTP_HOST: "mailpit" }, () => assert.doesNotThrow(validateEmailConfiguration));
  withEnvironment({ ...base, SMTP_HOST: "smtp.example.com", SMTP_PORT: "587" }, () => assert.throws(validateEmailConfiguration, /must require TLS/));
  withEnvironment({ ...base, SMTP_HOST: "smtp.example.com", SMTP_PORT: "587", SMTP_REQUIRE_TLS: "true" }, () => assert.throws(validateEmailConfiguration, /must use authentication/));
  withEnvironment({ ...base, SMTP_HOST: "smtp.example.com", SMTP_PORT: "587", SMTP_REQUIRE_TLS: "true", SMTP_USERNAME: "mailer", SMTP_PASSWORD: "secret" }, () => assert.doesNotThrow(validateEmailConfiguration));
});
