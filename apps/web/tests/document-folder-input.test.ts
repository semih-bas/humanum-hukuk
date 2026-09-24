import assert from "node:assert/strict";
import test from "node:test";

import { documentFolderKeySchema, updateDocumentFoldersSchema } from "../src/lib/document-folder-input";

test("evrak klasör anahtarlarını ve özel klasör listesini doğrular", () => {
  const custom = "CUSTOM:123e4567-e89b-12d3-a456-426614174000";
  assert.equal(documentFolderKeySchema.safeParse("PAYMENT").success, true);
  assert.equal(documentFolderKeySchema.safeParse(custom).success, true);
  assert.equal(documentFolderKeySchema.safeParse("../unsafe").success, false);
  assert.equal(updateDocumentFoldersSchema.safeParse({ folders: [{ key: custom, label: "Bilirkişi Belgeleri" }] }).success, true);
  assert.equal(updateDocumentFoldersSchema.safeParse({ folders: [{ key: custom, label: "A" }, { key: custom, label: "B" }] }).success, false);
});
