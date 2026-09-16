import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/database";
import { assertDocumentQuota, DOCUMENT_STORAGE_LOCK_ID, documentStorageLimits } from "@/lib/document-limits";
import { hasExpectedDocumentDigest } from "@/lib/document-integrity";
import { inspectDocumentUpload } from "@/lib/document-validation";

import { generalCaseAccessWhere, type GeneralCaseActor } from "./access";
import type { GeneralCaseDocumentCategory } from "./document-input";

export class GeneralCaseDocumentNotFoundError extends Error {}

export async function listGeneralCaseDocuments(caseId: string, actor: GeneralCaseActor) {
  const activeCase = await prisma.generalLegalCase.findFirst({
    where: { id: caseId, archivedAt: null, ...generalCaseAccessWhere(actor) },
    select: { id: true },
  });
  if (!activeCase) throw new GeneralCaseDocumentNotFoundError();
  const documents = await prisma.generalCaseDocument.findMany({
    where: { caseId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, originalName: true, category: true, mimeType: true, sizeBytes: true, createdAt: true, uploadedBy: { select: { id: true, name: true } } },
  });
  return documents.map((document) => ({ ...document, createdAt: document.createdAt.toISOString() }));
}

export async function storeGeneralCaseDocument(caseId: string, file: File, category: GeneralCaseDocumentCategory, actor: GeneralCaseActor) {
  const inspected = await inspectDocumentUpload(file);
  const token = randomBytes(32).toString("hex");
  const storageKey = `general/${token.slice(0, 2)}/${token}.${inspected.extension}`;
  const absolutePath = resolveStorageKey(storageKey);
  let fileCreated = false;

  try {
    const document = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${DOCUMENT_STORAGE_LOCK_ID})`;
      const activeCase = await transaction.generalLegalCase.findFirst({
        where: { id: caseId, archivedAt: null, ...generalCaseAccessWhere(actor) },
        select: { id: true, referenceNumber: true },
      });
      if (!activeCase) throw new GeneralCaseDocumentNotFoundError();

      const root = storageRoot();
      await mkdir(root, { recursive: true });
      const [caseDocumentCount, storageUsage] = await Promise.all([
        transaction.generalCaseDocument.count({ where: { caseId } }),
        transaction.generalCaseDocument.aggregate({ _sum: { sizeBytes: true } }),
      ]);
      assertDocumentQuota(
        { caseDocumentCount, storedBytes: Math.max(storageUsage._sum.sizeBytes ?? 0, await storedFileBytes(root)) },
        inspected.buffer.byteLength,
        documentStorageLimits(),
      );

      await mkdir(path.dirname(absolutePath), { recursive: true });
      const handle = await open(absolutePath, "wx", 0o600);
      fileCreated = true;
      try { await handle.writeFile(inspected.buffer); } finally { await handle.close(); }

      const created = await transaction.generalCaseDocument.create({
        data: { caseId, uploadedById: actor.id, originalName: inspected.originalName, category, storageKey, mimeType: inspected.mimeType, sizeBytes: inspected.buffer.byteLength, sha256: inspected.sha256 },
        select: { id: true, originalName: true, category: true, mimeType: true, sizeBytes: true, createdAt: true },
      });
      await transaction.auditLog.create({
        data: { actorUserId: actor.id, event: "general_legal_case.document_uploaded", targetType: "general_legal_case", targetId: caseId, context: { referenceNumber: activeCase.referenceNumber, documentId: created.id, category, mimeType: created.mimeType, sizeBytes: created.sizeBytes } },
      });
      return created;
    }, { timeout: 30_000 });
    return { ...document, createdAt: document.createdAt.toISOString() };
  } catch (error) {
    if (fileCreated) await unlink(absolutePath).catch(() => undefined);
    throw error;
  }
}

export async function readGeneralCaseDocument(caseId: string, documentId: string, actor: GeneralCaseActor) {
  const document = await prisma.generalCaseDocument.findFirst({
    where: { id: documentId, caseId, case: { archivedAt: null, ...generalCaseAccessWhere(actor) } },
    select: { originalName: true, storageKey: true, mimeType: true, sizeBytes: true, sha256: true },
  });
  if (!document) throw new GeneralCaseDocumentNotFoundError();
  try {
    const data = await readFile(/* turbopackIgnore: true */ resolveStorageKey(document.storageKey));
    if (data.byteLength !== document.sizeBytes || !hasExpectedDocumentDigest(data, document.sha256)) throw new Error("Invalid document data");
    return { ...document, data };
  } catch { throw new GeneralCaseDocumentNotFoundError(); }
}

async function storedFileBytes(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) total += await storedFileBytes(entryPath);
    else if (entry.isFile()) total += (await stat(entryPath)).size;
  }
  return total;
}

function storageRoot() {
  const configured = process.env.DOCUMENT_STORAGE_PATH?.trim();
  if (!configured && process.env.NODE_ENV === "production") throw new Error("Missing required environment variable: DOCUMENT_STORAGE_PATH");
  return path.resolve(/* turbopackIgnore: true */ configured || path.join(process.cwd(), ".data", "documents"));
}

function resolveStorageKey(storageKey: string) {
  if (!/^general\/[a-f0-9]{2}\/[a-f0-9]{64}\.(?:pdf|jpg|png)$/.test(storageKey)) throw new GeneralCaseDocumentNotFoundError();
  const root = storageRoot(); const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new GeneralCaseDocumentNotFoundError();
  return resolved;
}
