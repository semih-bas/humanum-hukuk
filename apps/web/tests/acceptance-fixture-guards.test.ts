import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { assertAcceptanceFixtureEnvironment, readFixtureBatchId } from "../scripts/acceptance-fixture-data";
import { resolveFixtureStorageKey } from "../scripts/acceptance-fixture-database";

function withEnvironment(values: Record<string, string | undefined>, check: () => void) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    check();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("fixture tools reject unapproved or non-acceptance targets", () => {
  const environment = {
    ACCEPTANCE_FIXTURE_ALLOWED: "true",
    MIGRATION_DATABASE_URL: "postgresql://test:test@database:5432/humanum_hukuk_acceptance",
    BETTER_AUTH_URL: "http://localhost:3001",
    DOCUMENT_STORAGE_PATH: "/var/lib/humanum/documents",
  };
  withEnvironment(environment, () => assert.doesNotThrow(assertAcceptanceFixtureEnvironment));
  for (const invalid of [
    { ACCEPTANCE_FIXTURE_ALLOWED: undefined },
    { MIGRATION_DATABASE_URL: "postgresql://test:test@database:5432/humanum_hukuk" },
    { MIGRATION_DATABASE_URL: "postgresql://test:test@production:5432/humanum_hukuk_acceptance" },
    { BETTER_AUTH_URL: "https://example.com" },
    { DOCUMENT_STORAGE_PATH: "/var/lib" },
  ]) {
    withEnvironment({ ...environment, ...invalid }, () => assert.throws(assertAcceptanceFixtureEnvironment));
  }
});

test("fixture batch identifiers cannot become arbitrary quarantine paths", () => {
  for (const value of ["../outside", "BATCH/2026", "BATCH\\2026", "short", "A".repeat(65)]) {
    withEnvironment({ ACCEPTANCE_FIXTURE_BATCH: value }, () => assert.throws(readFixtureBatchId));
  }
  withEnvironment({ ACCEPTANCE_FIXTURE_BATCH: " HH-ACC-20260903-V1 " }, () => {
    assert.equal(readFixtureBatchId(), "HH-ACC-20260903-V1");
  });
});

test("fixture document paths stay inside the configured storage root", () => {
  withEnvironment({ DOCUMENT_STORAGE_PATH: "/var/lib/humanum/documents" }, () => {
    const key = `ab/${"a".repeat(64)}.pdf`;
    assert.equal(resolveFixtureStorageKey(key), path.resolve("/var/lib/humanum/documents", key));
    for (const invalid of ["../outside.pdf", "/etc/passwd", "C:\\outside.pdf", key.replace(".pdf", ".exe"), `ab/../${"a".repeat(64)}.pdf`]) {
      assert.throws(() => resolveFixtureStorageKey(invalid));
    }
  });
});
