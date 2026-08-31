import { access, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import { config } from "dotenv";

import {
  assertAcceptanceFixtureEnvironment,
  buildAcceptanceFixtureDataset,
  fixturePrefixes,
  readFixtureBatchId,
} from "./acceptance-fixture-data";
import {
  createAcceptanceFixturePrisma,
  fixtureStorageRoot,
  resolveFixtureStorageKey,
} from "./acceptance-fixture-database";

config({ path: [".env.acceptance.bootstrap", ".env.acceptance.app", ".env.acceptance.database"], quiet: true });
assertAcceptanceFixtureEnvironment();

const batchId = readFixtureBatchId();
const prefixes = fixturePrefixes(batchId);
const dataset = buildAcceptanceFixtureDataset(batchId);
const fixtureEmails = dataset.users.map((user) => user.email);
const prisma = createAcceptanceFixturePrisma();
const movedFiles: Array<{ source: string; quarantine: string }> = [];
const missingFiles: string[] = [];

try {
  const fixtureUserWhere = { startsWith: prefixes.user } as const;
  const affectedCases = await prisma.caseFile.findMany({
    where: {
      OR: [
        { id: { startsWith: prefixes.caseFile } },
        { createdById: fixtureUserWhere },
        { updatedById: fixtureUserWhere },
        { archivedById: fixtureUserWhere },
      ],
    },
    select: { id: true },
  });
  const affectedCaseIds = affectedCases.map((caseFile) => caseFile.id);
  const documents = await prisma.caseDocument.findMany({
    where: {
      OR: [
        { caseFileId: { in: affectedCaseIds } },
        { uploadedById: fixtureUserWhere },
        { id: { startsWith: prefixes.document } },
      ],
    },
    select: { id: true, storageKey: true },
  });

  await quarantineDocuments(documents.map((document) => document.storageKey));

  const deleted = await prisma.$transaction(async (transaction) => {
    const auditLogs = await transaction.auditLog.deleteMany({
      where: {
        OR: [
          { id: { startsWith: prefixes.audit } },
          { actorUserId: fixtureUserWhere },
          { targetId: { in: affectedCaseIds } },
          { targetId: batchId },
        ],
      },
    });
    const documentsOnOtherCases = await transaction.caseDocument.deleteMany({
      where: { uploadedById: fixtureUserWhere, caseFileId: { notIn: affectedCaseIds } },
    });
    const remindersOnOtherCases = await transaction.caseReminder.deleteMany({
      where: { createdById: fixtureUserWhere, caseFileId: { notIn: affectedCaseIds } },
    });
    const notesOnOtherCases = await transaction.caseNote.deleteMany({
      where: { authorId: fixtureUserWhere, caseFileId: { notIn: affectedCaseIds } },
    });
    const changesOnOtherCases = await transaction.caseFileChange.deleteMany({
      where: { changedById: fixtureUserWhere, caseFileId: { notIn: affectedCaseIds } },
    });
    const cases = await transaction.caseFile.deleteMany({ where: { id: { in: affectedCaseIds } } });
    const verifications = await transaction.verification.deleteMany({
      where: { identifier: { in: fixtureEmails } },
    });
    const users = await transaction.user.deleteMany({ where: { id: fixtureUserWhere } });
    return {
      auditLogs: auditLogs.count,
      documentsOnOtherCases: documentsOnOtherCases.count,
      remindersOnOtherCases: remindersOnOtherCases.count,
      notesOnOtherCases: notesOnOtherCases.count,
      changesOnOtherCases: changesOnOtherCases.count,
      cases: cases.count,
      verifications: verifications.count,
      users: users.count,
    };
  }, { maxWait: 15_000, timeout: 120_000 });

  await removeQuarantine();
  await verifyCleanup();
  console.log(JSON.stringify({
    status: "acceptance-fixtures-cleaned",
    batchId,
    deleted,
    quarantinedDocuments: movedFiles.length,
    missingDocumentFiles: missingFiles.length,
  }, null, 2));
} catch (error) {
  await restoreQuarantine();
  throw error;
} finally {
  await prisma.$disconnect();
}

async function quarantineDocuments(storageKeys: string[]): Promise<void> {
  const quarantineRoot = path.join(fixtureStorageRoot(), ".fixture-trash", batchId);
  for (const storageKey of [...new Set(storageKeys)]) {
    const source = resolveFixtureStorageKey(storageKey);
    const quarantine = path.join(quarantineRoot, storageKey);
    try {
      await access(source);
    } catch (error) {
      if (isMissing(error)) {
        missingFiles.push(storageKey);
        continue;
      }
      throw error;
    }
    await mkdir(path.dirname(quarantine), { recursive: true });
    await rename(source, quarantine);
    movedFiles.push({ source, quarantine });
  }
}

async function restoreQuarantine(): Promise<void> {
  for (const file of [...movedFiles].reverse()) {
    try {
      await mkdir(path.dirname(file.source), { recursive: true });
      await rename(file.quarantine, file.source);
    } catch (error) {
      console.error(`Could not restore quarantined fixture document: ${file.source}`, error);
    }
  }
}

async function removeQuarantine(): Promise<void> {
  const quarantineRoot = path.join(fixtureStorageRoot(), ".fixture-trash", batchId);
  await rm(quarantineRoot, { recursive: true, force: true });
}

async function verifyCleanup(): Promise<void> {
  const [users, cases, changes, notes, reminders, documents, audits] = await Promise.all([
    prisma.user.count({ where: { id: { startsWith: prefixes.user } } }),
    prisma.caseFile.count({ where: { id: { startsWith: prefixes.caseFile } } }),
    prisma.caseFileChange.count({ where: { id: { startsWith: prefixes.change } } }),
    prisma.caseNote.count({ where: { id: { startsWith: prefixes.note } } }),
    prisma.caseReminder.count({ where: { id: { startsWith: prefixes.reminder } } }),
    prisma.caseDocument.count({ where: { id: { startsWith: prefixes.document } } }),
    prisma.auditLog.count({ where: { id: { startsWith: prefixes.audit } } }),
  ]);
  const remaining = { users, cases, changes, notes, reminders, documents, audits };
  if (Object.values(remaining).some((count) => count !== 0)) {
    throw new Error(`Acceptance fixture cleanup verification failed: ${JSON.stringify(remaining)}`);
  }
  for (const file of movedFiles) {
    try {
      await access(file.source);
      throw new Error(`Acceptance fixture document remains after cleanup: ${file.source}`);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
