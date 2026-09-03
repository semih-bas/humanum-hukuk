import { access, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import { config } from "dotenv";
import { emailRateLimitKey } from "../src/lib/email-rate-limit-key";

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

config({
  path: [
    ".env.acceptance.bootstrap",
    ".env.acceptance.app",
    ".env.acceptance.database",
  ],
  quiet: true,
});
assertAcceptanceFixtureEnvironment();

const batchId = readFixtureBatchId();
const prefixes = fixturePrefixes(batchId);
const dataset = buildAcceptanceFixtureDataset(batchId);
const fixtureEmails = dataset.users.map((user) => user.email);
const prisma = createAcceptanceFixturePrisma();
const movedFiles: Array<{ source: string; quarantine: string }> = [];
const missingFiles: string[] = [];
let databaseCommitted = false;

try {
  const fixtureUserWhere = { startsWith: prefixes.user } as const;
  const affectedCases = await prisma.caseFile.findMany({
    // An actor's involvement never proves ownership of an existing case.
    where: { id: { startsWith: prefixes.caseFile } },
    select: { id: true },
  });
  const affectedCaseIds = affectedCases.map((caseFile) => caseFile.id);
  const documents = await prisma.caseDocument.findMany({
    where: { caseFileId: { in: affectedCaseIds } },
    select: { id: true, storageKey: true },
  });

  const outsideCases = { caseFileId: { notIn: affectedCaseIds } };
  const referencesOutsideBatch = await Promise.all([
    prisma.caseFile.count({
      where: {
        id: { notIn: affectedCaseIds },
        OR: [
          { createdById: fixtureUserWhere },
          { updatedById: fixtureUserWhere },
          { archivedById: fixtureUserWhere },
        ],
      },
    }),
    prisma.caseNote.count({
      where: { ...outsideCases, authorId: fixtureUserWhere },
    }),
    prisma.caseDocument.count({
      where: { ...outsideCases, uploadedById: fixtureUserWhere },
    }),
    prisma.caseReminder.count({
      where: { ...outsideCases, createdById: fixtureUserWhere },
    }),
    prisma.caseFileChange.count({
      where: { ...outsideCases, changedById: fixtureUserWhere },
    }),
    prisma.caseDocument.count({
      where: {
        ...outsideCases,
        storageKey: { in: documents.map((item) => item.storageKey) },
      },
    }),
  ]);
  if (referencesOutsideBatch.some(Boolean))
    throw new Error(
      "Cleanup stopped: fixture users or files are referenced outside the selected batch. Preserve those records and resolve ownership explicitly.",
    );
  const remainingAdmins = await prisma.user.count({
    where: {
      NOT: { id: fixtureUserWhere },
      role: "admin",
      emailVerified: true,
      OR: [{ banned: false }, { banned: null }],
    },
  });
  if (!remainingAdmins)
    throw new Error(
      "Cleanup must preserve an active verified administrator outside the fixture batch.",
    );
  const protectedCounts = await preservedCounts(affectedCaseIds);
  const reminders = await prisma.caseReminder.findMany({
    where: { caseFileId: { in: affectedCaseIds } },
    select: { id: true },
  });
  const reminderIds = reminders.map((item) => item.id);
  const userIds = (
    await prisma.user.findMany({
      where: { id: fixtureUserWhere },
      select: { id: true },
    })
  ).map((item) => item.id);
  let documentBytes = 0;
  for (const document of documents) {
    try {
      documentBytes += (
        await stat(resolveFixtureStorageKey(document.storageKey))
      ).size;
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
  const preview = {
    batchId,
    users: userIds.length,
    cases: affectedCaseIds.length,
    reminders: reminders.length,
    documents: documents.length,
    documentBytes,
    preserved: protectedCounts,
  };
  if (!process.argv.includes("--apply")) {
    console.log(
      JSON.stringify(
        { status: "acceptance-cleanup-preview", ...preview },
        null,
        2,
      ),
    );
  } else {
    if (process.env.ACCEPTANCE_FIXTURE_CLEANUP_CONFIRM !== batchId)
      throw new Error(
        "Set ACCEPTANCE_FIXTURE_CLEANUP_CONFIRM to the exact previewed batch before applying cleanup.",
      );

    await quarantineDocuments(documents.map((document) => document.storageKey));

    const deleted = await prisma.$transaction(
      async (transaction) => {
        const auditLogs = await transaction.auditLog.deleteMany({
          where: {
            OR: [
              { id: { startsWith: prefixes.audit } },
              { actorUserId: fixtureUserWhere },
              { targetId: { in: affectedCaseIds } },
              { targetId: { in: reminderIds } },
              { targetId: { in: userIds } },
              { targetId: batchId },
            ],
          },
        });
        const cases = await transaction.caseFile.deleteMany({
          where: { id: { in: affectedCaseIds } },
        });
        const verifications = await transaction.verification.deleteMany({
          where: {
            OR: [
              { identifier: { in: fixtureEmails } },
              {
                identifier: { startsWith: "reset-password:" },
                value: { in: userIds },
              },
            ],
          },
        });
        const quotaKeys = fixtureEmails.flatMap((email) =>
          (["verification", "password-reset", "reminder"] as const).flatMap(
            (category) =>
              ["request", "delivery"].flatMap((scope) =>
                [
                  "cooldown",
                  "burst",
                  "daily",
                  "hourly",
                  "successful-daily",
                ].map((rule) =>
                  emailRateLimitKey(scope, category, email, rule),
                ),
              ),
          ),
        );
        const quotas = await transaction.emailRateLimit.deleteMany({
          where: { key: { in: quotaKeys } },
        });
        const users = await transaction.user.deleteMany({
          where: { id: fixtureUserWhere },
        });
        return {
          auditLogs: auditLogs.count,
          recipientQuotaRecords: quotas.count,
          cases: cases.count,
          verifications: verifications.count,
          users: users.count,
        };
      },
      { maxWait: 15_000, timeout: 120_000 },
    );
    databaseCommitted = true;

    await verifyCleanup();
    if (
      JSON.stringify(await preservedCounts(affectedCaseIds)) !==
      JSON.stringify(protectedCounts)
    ) {
      throw new Error(
        "Preserved record counts changed; quarantined files were retained for inspection.",
      );
    }
    await removeQuarantine();
    console.log(
      JSON.stringify(
        {
          status: "acceptance-fixtures-cleaned",
          batchId,
          deleted,
          quarantinedDocuments: movedFiles.length,
          missingDocumentFiles: missingFiles.length,
          preserved: protectedCounts,
        },
        null,
        2,
      ),
    );
  }
} catch (error) {
  // After a DB commit, restoring files without their records would create orphans.
  if (!databaseCommitted) await restoreQuarantine();
  else
    console.error(
      "Database cleanup committed; keep any remaining .fixture-trash batch directory for recovery review.",
    );
  throw error;
} finally {
  await prisma.$disconnect();
}

async function quarantineDocuments(storageKeys: string[]): Promise<void> {
  const quarantineRoot = path.join(
    fixtureStorageRoot(),
    ".fixture-trash",
    batchId,
  );
  try {
    await access(quarantineRoot);
    throw new Error(
      "A previous quarantine exists for this batch; inspect it before retrying.",
    );
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
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
      console.error(
        `Could not restore quarantined fixture document: ${file.source}`,
        error,
      );
    }
  }
}

async function removeQuarantine(): Promise<void> {
  const quarantineRoot = path.resolve(
    fixtureStorageRoot(),
    ".fixture-trash",
    batchId,
  );
  if (
    path.dirname(quarantineRoot) !==
    path.join(fixtureStorageRoot(), ".fixture-trash")
  )
    throw new Error("Unsafe fixture quarantine path.");
  await rm(quarantineRoot, { recursive: true, force: true });
}

async function preservedCounts(affectedCaseIds: string[]) {
  const outside = { caseFileId: { notIn: affectedCaseIds } };
  const [users, cases, notes, reminders, documents, changes] =
    await Promise.all([
      prisma.user.count({
        where: { NOT: { id: { startsWith: prefixes.user } } },
      }),
      prisma.caseFile.count({ where: { id: { notIn: affectedCaseIds } } }),
      prisma.caseNote.count({ where: outside }),
      prisma.caseReminder.count({ where: outside }),
      prisma.caseDocument.count({ where: outside }),
      prisma.caseFileChange.count({ where: outside }),
    ]);
  return { users, cases, notes, reminders, documents, changes };
}

async function verifyCleanup(): Promise<void> {
  const [users, cases, changes, notes, reminders, documents, audits] =
    await Promise.all([
      prisma.user.count({ where: { id: { startsWith: prefixes.user } } }),
      prisma.caseFile.count({
        where: { id: { startsWith: prefixes.caseFile } },
      }),
      prisma.caseFileChange.count({
        where: { id: { startsWith: prefixes.change } },
      }),
      prisma.caseNote.count({ where: { id: { startsWith: prefixes.note } } }),
      prisma.caseReminder.count({
        where: { id: { startsWith: prefixes.reminder } },
      }),
      prisma.caseDocument.count({
        where: { id: { startsWith: prefixes.document } },
      }),
      prisma.auditLog.count({ where: { id: { startsWith: prefixes.audit } } }),
    ]);
  const remaining = {
    users,
    cases,
    changes,
    notes,
    reminders,
    documents,
    audits,
  };
  if (Object.values(remaining).some((count) => count !== 0)) {
    throw new Error(
      `Acceptance fixture cleanup verification failed: ${JSON.stringify(remaining)}`,
    );
  }
  for (const file of movedFiles) {
    try {
      await access(file.source);
      throw new Error(
        `Acceptance fixture document remains after cleanup: ${file.source}`,
      );
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
