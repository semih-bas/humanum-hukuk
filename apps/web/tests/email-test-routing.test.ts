import assert from "node:assert/strict";
import test from "node:test";
import { shouldRouteRealTestEmail } from "../src/lib/email-test-routing";

const env = {
  REAL_EMAIL_TEST_CONFIG: "/run/secrets/real-email",
  REAL_EMAIL_TEST_RECIPIENTS: "approved@example.com",
  SMTP_HOST: "mailpit", SMTP_PORT: "1025", BETTER_AUTH_URL: "http://localhost:3001",
};

test("real mail test is disabled by default and only exact approved recipients opt in", () => {
  assert.equal(shouldRouteRealTestEmail("approved@example.com", {}), false);
  assert.equal(shouldRouteRealTestEmail(" APPROVED@example.com ", env), true);
  for (const to of ["other@example.com", "approved+alias@example.com", "Name <approved@example.com>", "approved@example.com,other@example.com", "approved@example.com\r\nBcc: other@example.com"]) {
    assert.equal(shouldRouteRealTestEmail(to, env), false);
  }
  assert.equal(shouldRouteRealTestEmail("approved@example.com", { ...env, REAL_EMAIL_TEST_RECIPIENTS: "" }), false);
});

test("reserved synthetic recipients cannot be routed to real SMTP even if allowlisted", () => {
  for (const domain of ["example.invalid", "example.test", "humanum.local", "test.localhost"]) {
    const to = `test@${domain}`;
    assert.equal(shouldRouteRealTestEmail(to, { ...env, REAL_EMAIL_TEST_RECIPIENTS: to }), false);
  }
});

test("real mail test fails closed outside local Mailpit acceptance", () => {
  for (const override of [{ SMTP_HOST: "smtp.gmail.com" }, { SMTP_PORT: "465" }, { BETTER_AUTH_URL: "https://app.example.com" }]) {
    assert.throws(() => shouldRouteRealTestEmail("approved@example.com", { ...env, ...override }));
  }
});
