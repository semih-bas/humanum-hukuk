import assert from "node:assert/strict";
import test from "node:test";

import { resourceIdSchema } from "../src/lib/resource-id";

test("üretim ve kabul testi kimliklerini kabul eder", () => {
  assert.equal(resourceIdSchema.safeParse("cm1234567890abcdefghijkl").success, true);
  assert.equal(resourceIdSchema.safeParse("fixture:HH-ACC-20260831-V1:case:001").success, true);
  assert.equal(resourceIdSchema.safeParse("fixture:HH-ACC-20260831-V1:document:001:01").success, true);
});

test("yol veya sorgu karakteri içeren kimlikleri reddeder", () => {
  for (const value of ["../case", "case/other", "case?admin=true", "case%2Fother", "case value", ""]) {
    assert.equal(resourceIdSchema.safeParse(value).success, false, value);
  }
});
