import { createHash } from "node:crypto";
import { mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";

import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";

import type { Prisma } from "../src/generated/prisma/client";
import {
  assertAcceptanceFixtureEnvironment,
  buildAcceptanceFixtureDataset,
  fixturePrefixes,
  readFixtureBatchId,
} from "./acceptance-fixture-data";
import {
  createAcceptanceFixturePrisma,
  resolveFixtureStorageKey,
  verifyAcceptanceFixtures,
} from "./acceptance-fixture-database";

config({ path: [".env.acceptance.bootstrap", ".env.acceptance.app", ".env.acceptance.database"], quiet: true });
assertAcceptanceFixtureEnvironment();

const batchId = readFixtureBatchId();
const fixturePassword = process.env.ACCEPTANCE_FIXTURE_PASSWORD;
if (!fixturePassword || fixturePassword.length < 16) {
  throw new Error("ACCEPTANCE_FIXTURE_PASSWORD must contain at least 16 characters.");
}

const dataset = buildAcceptanceFixtureDataset(batchId);
const prefixes = fixturePrefixes(batchId);
const prisma = createAcceptanceFixturePrisma();
const createdFiles: string[] = [];

try {
  await prepareFixtureFiles();
  const passwordHash = await hashPassword(fixturePassword);

  await prisma.$transaction(async (transaction) => {
    for (const user of dataset.users) {
      await transaction.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          role: user.role,
          mustChangePassword: false,
          banned: user.banned,
          banReason: user.banReason,
          createdAt: user.createdAt,
          updatedAt: user.createdAt,
        },
        update: {
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          role: user.role,
          mustChangePassword: false,
          banned: user.banned,
          banReason: user.banReason,
          banExpires: null,
        },
      });
      await transaction.account.upsert({
        where: { id: user.accountId },
        create: {
          id: user.accountId,
          issuer: "local:credential",
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
          createdAt: user.createdAt,
          updatedAt: user.createdAt,
        },
        update: {
          issuer: "local:credential",
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
        },
      });
    }

    for (const caseFile of dataset.cases) {
      const caseData = {
        referenceNumber: caseFile.referenceNumber,
        licenseHolder: caseFile.licenseHolder,
        vehiclePlate: caseFile.vehiclePlate,
        accidentDate: new Date(`${caseFile.accidentDate}T00:00:00.000Z`),
        debtorType: caseFile.debtorType,
        debtorName: caseFile.debtorName,
        damageAmount: caseFile.damageAmount,
        depreciationAmount: caseFile.depreciationAmount,
        profitLossAmount: caseFile.profitLossAmount,
        discountAmount: caseFile.discountAmount,
        enforcementOffice: caseFile.enforcementOffice,
        enforcementFileNumber: caseFile.enforcementFileNumber,
        vehicleLien: caseFile.vehicleLien,
        bankLien: caseFile.bankLien,
        titleDeedLien: caseFile.titleDeedLien,
        installmentCount: caseFile.installmentCount,
        status: caseFile.status,
        version: caseFile.version,
        createdById: caseFile.createdById,
        updatedById: caseFile.updatedById,
        archivedAt: null,
        archivedById: null,
      };
      await transaction.caseFile.upsert({
        where: { id: caseFile.id },
        create: { id: caseFile.id, ...caseData, createdAt: caseFile.createdAt, updatedAt: caseFile.createdAt },
        update: caseData,
      });

      for (const change of caseFile.changes) {
        const changeData = {
          caseFileId: caseFile.id,
          changedById: change.changedById,
          changeType: change.changeType,
          previousVersion: change.previousVersion,
          newVersion: change.newVersion,
          changedFields: change.changedFields as Prisma.InputJsonValue,
          snapshot: change.snapshot as Prisma.InputJsonValue,
          createdAt: change.createdAt,
        };
        await transaction.caseFileChange.upsert({
          where: { id: change.id },
          create: { id: change.id, ...changeData },
          update: changeData,
        });
      }
      for (const note of caseFile.notes) {
        const noteData = {
          caseFileId: note.caseFileId,
          authorId: note.authorId,
          content: note.content,
          createdAt: note.createdAt,
          updatedAt: note.createdAt,
        };
        await transaction.caseNote.upsert({
          where: { id: note.id },
          create: { id: note.id, ...noteData },
          update: noteData,
        });
      }
      for (const reminder of caseFile.reminders) {
        const reminderData = {
          caseFileId: reminder.caseFileId,
          createdById: reminder.createdById,
          title: reminder.title,
          dueAt: reminder.dueAt,
          sendEmail: reminder.sendEmail,
          sendSms: reminder.sendSms,
          status: reminder.status,
          sentAt: reminder.sentAt,
        };
        await transaction.caseReminder.upsert({
          where: { id: reminder.id },
          create: { id: reminder.id, ...reminderData, createdAt: caseFile.createdAt, updatedAt: caseFile.createdAt },
          update: reminderData,
        });
      }
      for (const document of caseFile.documents) {
        const documentData = {
          caseFileId: document.caseFileId,
          uploadedById: document.uploadedById,
          originalName: document.originalName,
          storageKey: document.storageKey,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
          sha256: document.sha256,
          createdAt: document.createdAt,
        };
        await transaction.caseDocument.upsert({
          where: { id: document.id },
          create: { id: document.id, ...documentData },
          update: documentData,
        });
      }
    }

    await transaction.auditLog.upsert({
      where: { id: `${prefixes.audit}batch` },
      create: {
        id: `${prefixes.audit}batch`,
        actorUserId: dataset.users[0].id,
        event: "fixture.batch_seeded",
        targetType: "acceptance_fixture_batch",
        targetId: batchId,
        context: {
          fixtureBatchId: batchId,
          synthetic: true,
          users: dataset.users.length,
          cases: dataset.cases.length,
        },
      },
      update: {
        actorUserId: dataset.users[0].id,
        context: {
          fixtureBatchId: batchId,
          synthetic: true,
          users: dataset.users.length,
          cases: dataset.cases.length,
        },
      },
    });
  }, { maxWait: 15_000, timeout: 120_000 });

  const summary = await verifyAcceptanceFixtures(prisma, batchId);
  console.log(JSON.stringify({ status: "acceptance-fixtures-ready", ...summary }, null, 2));
} catch (error) {
  await Promise.all(createdFiles.map((filePath) => unlink(filePath).catch(() => undefined)));
  throw error;
} finally {
  await prisma.$disconnect();
}

async function prepareFixtureFiles(): Promise<void> {
  for (const caseFile of dataset.cases) {
    for (const document of caseFile.documents) {
      const filePath = resolveFixtureStorageKey(document.storageKey);
      await mkdir(path.dirname(filePath), { recursive: true });
      try {
        const existing = await stat(filePath);
        if (existing.size !== document.sizeBytes) throw new Error(`Existing fixture document size mismatch: ${document.id}`);
        const existingHash = createHash("sha256").update(await readFile(filePath)).digest("hex");
        if (existingHash !== document.sha256) throw new Error(`Existing fixture document hash mismatch: ${document.id}`);
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
        const handle = await open(filePath, "wx", 0o600);
        try {
          await handle.writeFile(document.content);
        } finally {
          await handle.close();
        }
        createdFiles.push(filePath);
      }
    }
  }
}
