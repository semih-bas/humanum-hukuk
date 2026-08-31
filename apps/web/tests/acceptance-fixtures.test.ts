import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAcceptanceFixtureDataset,
  DEFAULT_ACCEPTANCE_FIXTURE_BATCH,
  FIXTURE_COUNTS,
} from "../scripts/acceptance-fixture-data";

const dataset = buildAcceptanceFixtureDataset(DEFAULT_ACCEPTANCE_FIXTURE_BATCH);

test("acceptance fixtures have deterministic unique identifiers and expected counts", () => {
  assert.equal(dataset.users.length, FIXTURE_COUNTS.users);
  assert.equal(dataset.cases.length, FIXTURE_COUNTS.cases);
  assert.equal(new Set(dataset.users.map((user) => user.id)).size, FIXTURE_COUNTS.users);
  assert.equal(new Set(dataset.users.map((user) => user.email)).size, FIXTURE_COUNTS.users);
  assert.equal(new Set(dataset.cases.map((caseFile) => caseFile.id)).size, FIXTURE_COUNTS.cases);
  assert.equal(new Set(dataset.cases.map((caseFile) => caseFile.referenceNumber)).size, FIXTURE_COUNTS.cases);
  assert.equal(dataset.cases.flatMap((caseFile) => caseFile.notes).length, 90);
  assert.equal(dataset.cases.flatMap((caseFile) => caseFile.reminders).length, 60);
  assert.equal(dataset.cases.flatMap((caseFile) => caseFile.documents).length, 60);
  assert.equal(dataset.cases.flatMap((caseFile) => caseFile.changes).length, 60);
});

test("acceptance fixtures are obviously synthetic and cover every case status evenly", () => {
  assert.ok(dataset.users.every((user) => user.email.endsWith("@example.invalid")));
  const statusCounts = dataset.cases.reduce<Record<string, number>>((counts, caseFile) => {
    counts[caseFile.status] = (counts[caseFile.status] ?? 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(statusCounts, { OPEN: 6, ENFORCEMENT: 6, INSTALLMENT: 6, PENDING: 6, CLOSED: 6 });
  assert.ok(dataset.cases.some((caseFile) => caseFile.licenseHolder.length > 100));
  assert.ok(dataset.cases.some((caseFile) => caseFile.notes.some((note) => note.content.length > 1_500)));
  assert.ok(dataset.cases.some((caseFile) => caseFile.reminders.some((reminder) => reminder.title.length > 300)));
  assert.ok(dataset.cases.some((caseFile) => caseFile.documents.some((document) => document.originalName.length > 200)));
});

test("acceptance fixture documents meet storage and content rules", () => {
  const documents = dataset.cases.flatMap((caseFile) => caseFile.documents);
  assert.equal(new Set(documents.map((document) => document.storageKey)).size, documents.length);
  for (const document of documents) {
    assert.match(document.storageKey, /^[a-f0-9]{2}\/[a-f0-9]{64}\.(?:pdf|png)$/);
    assert.equal(document.content.byteLength, document.sizeBytes);
    if (document.mimeType === "application/pdf") assert.equal(document.content.subarray(0, 5).toString(), "%PDF-");
    if (document.mimeType === "image/png") assert.deepEqual([...document.content.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
});
