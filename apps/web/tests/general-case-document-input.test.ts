import assert from "node:assert/strict";
import test from "node:test";

import { generalCaseDocumentCategorySchema, generalCaseDocumentNameSchema } from "../src/lib/general-legal-cases/document-input";

test("genel dava evrak kategorilerini sabit listeyle doğrular", () => {
  assert.equal(generalCaseDocumentCategorySchema.safeParse("DAVA_DILEKCESI").success, true);
  assert.equal(generalCaseDocumentCategorySchema.safeParse("DELIL").success, true);
  assert.equal(generalCaseDocumentCategorySchema.safeParse("../arsiv").success, false);
});

test("evrak adını normalize eder ve kontrol karakterlerini reddeder", () => {
  const result = generalCaseDocumentNameSchema.safeParse("  Bilirkişi   raporu  ");
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data, "Bilirkişi raporu");
  assert.equal(generalCaseDocumentNameSchema.safeParse("Karar\u0000.pdf").success, false);
});
