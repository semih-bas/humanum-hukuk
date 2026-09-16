import assert from "node:assert/strict";
import test from "node:test";

import { formatGeneralCaseReference } from "../src/lib/general-legal-cases/reference";

test("genel dava ve arabuluculuk için ayrı, sıralı referans üretir", () => {
  const instant = new Date("2026-09-16T10:00:00.000Z");
  assert.equal(formatGeneralCaseReference("GENERAL_LITIGATION", 27n, instant), "GD-2026-000027");
  assert.equal(formatGeneralCaseReference("MEDIATION", 28n, instant), "ARB-2026-000028");
});
