import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { buildDatabaseUrl } from "../src/lib/database-url";
import {
  buildAcceptanceFixtureDataset,
  FIXTURE_COUNTS,
  fixturePrefixes,
} from "./acceptance-fixture-data";

export function createAcceptanceFixturePrisma(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: buildDatabaseUrl("migration") }),
  });
}

export function fixtureStorageRoot(): string {
  const configured = process.env.DOCUMENT_STORAGE_PATH?.trim();
  if (!configured) throw new Error("Missing DOCUMENT_STORAGE_PATH for acceptance fixtures.");
  return path.resolve(configured);
}

export function resolveFixtureStorageKey(storageKey: string): string {
  if (!/^[a-f0-9]{2}\/[a-f0-9]{64}\.(?:pdf|jpg|png)$/.test(storageKey)) {
    throw new Error(`Unsafe fixture storage key: ${storageKey}`);
  }
  const root = fixtureStorageRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Fixture storage key escaped the storage root.");
  return resolved;
}

export async function verifyAcceptanceFixtures(prisma: PrismaClient, batchId: string) {
  const dataset = buildAcceptanceFixtureDataset(batchId);
  const prefixes = fixturePrefixes(batchId);
  const [users, accounts, cases, changes, notes, reminders, documents, audits, groupedStatuses, invalidReminderChannels] = await Promise.all([
    prisma.user.count({ where: { id: { startsWith: prefixes.user } } }),
    prisma.account.count({ where: { id: { startsWith: prefixes.account } } }),
    prisma.caseFile.count({ where: { id: { startsWith: prefixes.caseFile } } }),
    prisma.caseFileChange.count({ where: { id: { startsWith: prefixes.change } } }),
    prisma.caseNote.count({ where: { id: { startsWith: prefixes.note } } }),
    prisma.caseReminder.count({ where: { id: { startsWith: prefixes.reminder } } }),
    prisma.caseDocument.count({ where: { id: { startsWith: prefixes.document } } }),
    prisma.auditLog.count({ where: { id: { startsWith: prefixes.audit } } }),
    prisma.caseFile.groupBy({
      by: ["status"],
      where: { id: { startsWith: prefixes.caseFile } },
      _count: { _all: true },
    }),
    prisma.caseReminder.count({
      where: {
        id: { startsWith: prefixes.reminder },
        OR: [{ sendEmail: false }, { sendSms: true }],
      },
    }),
  ]);

  const expected = {
    users: FIXTURE_COUNTS.users,
    accounts: FIXTURE_COUNTS.users,
    cases: FIXTURE_COUNTS.cases,
    changes: FIXTURE_COUNTS.cases * FIXTURE_COUNTS.changesPerCase,
    notes: FIXTURE_COUNTS.cases * FIXTURE_COUNTS.notesPerCase,
    reminders: FIXTURE_COUNTS.cases * FIXTURE_COUNTS.remindersPerCase,
    documents: FIXTURE_COUNTS.cases * FIXTURE_COUNTS.documentsPerCase,
    audits: 1,
  };
  const actual = { users, accounts, cases, changes, notes, reminders, documents, audits };
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key as keyof typeof actual] !== value) {
      throw new Error(`Acceptance fixture count mismatch for ${key}: expected ${value}, found ${actual[key as keyof typeof actual]}.`);
    }
  }
  if (invalidReminderChannels !== 0) {
    throw new Error(`Acceptance fixtures contain ${invalidReminderChannels} reminder channels other than e-mail.`);
  }

  const statusCounts = Object.fromEntries(groupedStatuses.map((entry) => [entry.status, entry._count._all]));
  for (const status of ["OPEN", "ENFORCEMENT", "INSTALLMENT", "PENDING", "CLOSED"]) {
    if (statusCounts[status] !== 6) throw new Error(`Acceptance fixture status ${status} must contain 6 cases.`);
  }

  let verifiedFiles = 0;
  for (const caseFile of dataset.cases) {
    for (const document of caseFile.documents) {
      const filePath = resolveFixtureStorageKey(document.storageKey);
      const info = await stat(filePath);
      const contents = await readFile(filePath);
      if (info.size !== document.sizeBytes || createHash("sha256").update(contents).digest("hex") !== document.sha256) {
        throw new Error(`Acceptance fixture document integrity mismatch: ${document.id}`);
      }
      verifiedFiles += 1;
    }
  }

  return {
    batchId,
    ...actual,
    verifiedFiles,
    emailOnlyReminders: reminders,
    statusCounts,
    syntheticEmailDomain: "example.invalid",
  };
}
