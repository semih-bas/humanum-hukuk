import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

import { prisma } from "./database";
import { assertDocumentQuota, DOCUMENT_STORAGE_LOCK_ID, documentStorageLimits, DocumentQuotaExceededError } from "./document-limits";
import { hasExpectedDocumentDigest } from "./document-integrity";
import { CaseNotFoundError } from "./cases/update-case";
import { fixedDocumentFolders, parseDocumentFolders, type DocumentFolder } from "./document-folder-input";
import {
  DocumentValidationError,
  inspectDocumentUpload,
  MAX_DOCUMENT_BYTES,
  MAX_MULTIPART_BYTES,
} from "./document-validation";

export { DocumentValidationError, MAX_DOCUMENT_BYTES, MAX_MULTIPART_BYTES };
export { DocumentQuotaExceededError };
export class DocumentNotFoundError extends Error {}

export async function storeCaseDocument(caseFileId: string, file: File, actorUserId: string, requestedName?: string, transactionId?: string, category = "OTHER", folderKey = category) {
  const inspected = await inspectDocumentUpload(file, requestedName);
  const { buffer, originalName } = inspected;

  const token = randomBytes(32).toString("hex");
  const storageKey = `${token.slice(0, 2)}/${token}.${inspected.extension}`;
  const absolutePath = resolveStorageKey(storageKey);
  let fileCreated = false;

  try {
    const document = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${DOCUMENT_STORAGE_LOCK_ID})`;
      const activeCase = await transaction.caseFile.findFirst({ where: { id: caseFileId, archivedAt: null }, select: { id: true, referenceNumber: true, documentFolders: true } });
      if (!activeCase) throw new CaseNotFoundError();
      if (!hasDocumentFolder(activeCase.documentFolders, folderKey)) throw new DocumentValidationError("Evrak klasörü geçerli değildir.");
      if (transactionId) {
        const activeTransaction = await transaction.caseTransaction.findFirst({ where: { id: transactionId, caseFileId, deletedAt: null }, select: { id: true } });
        if (!activeTransaction) throw new CaseNotFoundError();
      }
      const root = storageRoot();
      await mkdir(root, { recursive: true });
      const [caseDocumentCount, storageUsage] = await Promise.all([
        transaction.caseDocument.count({ where: { caseFileId, deletedAt: null } }),
        transaction.caseDocument.aggregate({ _sum: { sizeBytes: true } }),
      ]);
      const physicalStorageBytes = await storedFileBytes(root);
      assertDocumentQuota(
        { caseDocumentCount, storedBytes: Math.max(storageUsage._sum.sizeBytes ?? 0, physicalStorageBytes) },
        buffer.byteLength,
        documentStorageLimits(),
      );

      await mkdir(path.dirname(absolutePath), { recursive: true });
      const handle = await open(absolutePath, "wx", 0o600);
      fileCreated = true;
      try {
        await handle.writeFile(buffer);
      } finally {
        await handle.close();
      }

      const created = await transaction.caseDocument.create({
        data: {
          caseFileId,
          uploadedById: actorUserId,
          originalName,
          storageKey,
          mimeType: inspected.mimeType,
          sizeBytes: buffer.byteLength,
          sha256: inspected.sha256,
          transactionId,
          category,
          folderKey,
        },
        select: { id: true, originalName: true, mimeType: true, sizeBytes: true, category: true, folderKey: true, createdAt: true },
      });
      await transaction.auditLog.create({
        data: { actorUserId, event: "case.document_uploaded", targetType: "case_file", targetId: caseFileId, context: { referenceNumber: activeCase.referenceNumber, documentId: created.id, mimeType: created.mimeType, sizeBytes: created.sizeBytes } },
      });
      return created;
    }, { timeout: 30_000 });
    return { ...document, createdAt: document.createdAt.toISOString() };
  } catch (error) {
    if (fileCreated) await unlink(absolutePath).catch(() => undefined);
    throw error;
  }
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

export async function readCaseDocument(caseFileId: string, documentId: string) {
  const document = await prisma.caseDocument.findFirst({
    where: { id: documentId, caseFileId, deletedAt: null, caseFile: { archivedAt: null } },
    select: { originalName: true, storageKey: true, mimeType: true, sizeBytes: true, sha256: true },
  });
  if (!document) throw new DocumentNotFoundError();

  try {
    const data = await readFile(/* turbopackIgnore: true */ resolveStorageKey(document.storageKey));
    if (data.byteLength !== document.sizeBytes) throw new Error("Stored document size mismatch.");
    if (!hasExpectedDocumentDigest(data, document.sha256)) throw new Error("Stored document digest mismatch.");
    return { ...document, data };
  } catch (error) {
    if (error instanceof DocumentNotFoundError) throw error;
    console.error("Stored document could not be read", { error: error instanceof Error ? error.name : "UnknownError", documentId });
    throw new DocumentNotFoundError();
  }
}

export async function moveCaseDocument(caseFileId: string, documentId: string, folderKey: string, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const activeCase = await transaction.caseFile.findFirst({ where: { id: caseFileId, archivedAt: null }, select: { referenceNumber: true, documentFolders: true } });
    if (!activeCase || !hasDocumentFolder(activeCase.documentFolders, folderKey)) throw new DocumentNotFoundError();
    const result = await transaction.caseDocument.updateMany({ where: { id: documentId, caseFileId, deletedAt: null }, data: { folderKey, category: folderKey.startsWith("CUSTOM:") ? "OTHER" : folderKey } });
    if (result.count !== 1) throw new DocumentNotFoundError();
    await transaction.auditLog.create({ data: { actorUserId, event: "case.document_moved", targetType: "case_file", targetId: caseFileId, context: { referenceNumber: activeCase.referenceNumber, documentId, folderKey } } });
    return { id: documentId, folderKey };
  });
}

export async function deleteCaseDocument(caseFileId: string, documentId: string, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const document = await transaction.caseDocument.findFirst({ where: { id: documentId, caseFileId, deletedAt: null, caseFile: { archivedAt: null } }, select: { originalName: true, caseFile: { select: { referenceNumber: true } } } });
    if (!document) throw new DocumentNotFoundError();
    const result = await transaction.caseDocument.updateMany({ where: { id: documentId, caseFileId, deletedAt: null }, data: { deletedAt: new Date(), deletedById: actorUserId } });
    if (result.count !== 1) throw new DocumentNotFoundError();
    await transaction.auditLog.create({ data: { actorUserId, event: "case.document_deleted", targetType: "case_file", targetId: caseFileId, context: { referenceNumber: document.caseFile.referenceNumber, documentId, originalName: document.originalName } } });
    return { id: documentId };
  });
}

export async function updateCaseDocumentFolders(caseFileId: string, folders: DocumentFolder[], actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const activeCase = await transaction.caseFile.findFirst({ where: { id: caseFileId, archivedAt: null }, select: { referenceNumber: true } });
    if (!activeCase) throw new CaseNotFoundError();
    await transaction.caseFile.update({ where: { id: caseFileId }, data: { documentFolders: folders } });
    await transaction.auditLog.create({ data: { actorUserId, event: "case.document_folders_updated", targetType: "case_file", targetId: caseFileId, context: { referenceNumber: activeCase.referenceNumber, folderCount: folders.length } } });
    return folders;
  });
}

function hasDocumentFolder(value: unknown, folderKey: string) {
  return fixedDocumentFolders.includes(folderKey as typeof fixedDocumentFolders[number]) || parseDocumentFolders(value).some((folder) => folder.key === folderKey);
}

function storageRoot(): string {
  const configured = process.env.DOCUMENT_STORAGE_PATH?.trim();
  if (!configured && process.env.NODE_ENV === "production") throw new Error("Missing required environment variable: DOCUMENT_STORAGE_PATH");
  return path.resolve(/* turbopackIgnore: true */ configured || path.join(process.cwd(), ".data", "documents"));
}

function resolveStorageKey(storageKey: string): string {
  if (!/^[a-f0-9]{2}\/[a-f0-9]{64}\.(?:pdf|jpg|png)$/.test(storageKey)) throw new DocumentNotFoundError();
  const root = storageRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new DocumentNotFoundError();
  return resolved;
}
