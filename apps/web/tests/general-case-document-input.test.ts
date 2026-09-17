import assert from "node:assert/strict";
import test from "node:test";

import { generalCaseDocumentCategorySchema, generalCaseDocumentFolderConfigSchema, generalCaseDocumentFolderKeySchema, generalCaseDocumentNameSchema } from "../src/lib/general-legal-cases/document-input";

test("genel dava evrak kategorilerini sabit listeyle doğrular", () => {
  assert.equal(generalCaseDocumentCategorySchema.safeParse("DAVA_DILEKCESI").success, true);
  assert.equal(generalCaseDocumentCategorySchema.safeParse("DELIL").success, true);
  assert.equal(generalCaseDocumentCategorySchema.safeParse("../arsiv").success, false);
});

test("evrak klasör anahtarlarını ve kalıcı klasör ayarlarını güvenle doğrular", () => {
  assert.equal(generalCaseDocumentFolderKeySchema.safeParse("DELIL").success, true);
  assert.equal(generalCaseDocumentFolderKeySchema.safeParse("CUSTOM:123e4567-e89b-12d3-a456-426614174000").success, true);
  assert.equal(generalCaseDocumentFolderKeySchema.safeParse("../gizli").success, false);
  assert.equal(generalCaseDocumentFolderConfigSchema.safeParse([{ key: "DELIL", label: "Deliller", hidden: true }]).success, true);
});

test("evrak adını normalize eder ve kontrol karakterlerini reddeder", () => {
  const result = generalCaseDocumentNameSchema.safeParse("  Bilirkişi   raporu  ");
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data, "Bilirkişi raporu");
  assert.equal(generalCaseDocumentNameSchema.safeParse("Karar\u0000.pdf").success, false);
});
