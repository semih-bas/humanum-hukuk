type TestRoutingEnvironment = Record<string, string | undefined>;

// This opt-in route is only for local acceptance. All other recipients stay in Mailpit.
export function shouldRouteRealTestEmail(to: string, env: TestRoutingEnvironment = process.env): boolean {
  if (!env.REAL_EMAIL_TEST_CONFIG) return false;
  if (env.SMTP_HOST !== "mailpit" || env.SMTP_PORT !== "1025") {
    throw new Error("Real email testing requires Mailpit as the default transport.");
  }
  const origin = new URL(env.BETTER_AUTH_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(origin.hostname)) {
    throw new Error("Real email testing requires a local application URL.");
  }
  const normalized = to.trim().toLowerCase();
  // Accept a single bare address, never display names, lists or reserved fixture domains.
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(normalized)) return false;
  const domain = normalized.split("@")[1];
  if (/(^|\.)(invalid|test|localhost|local)$/.test(domain)) return false;
  const allowed = (env.REAL_EMAIL_TEST_RECIPIENTS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(normalized);
}
