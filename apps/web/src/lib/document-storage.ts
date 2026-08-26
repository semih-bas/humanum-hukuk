import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { prisma } from "./database";
import { CaseNotFoundError } from "./cases/update-case";
import {
  DocumentValidationError,
  inspectDocumentUpload,
  MAX_DOCUMENT_BYTES,
  MAX_MULTIPART_BYTES,
} from "./document-validation";

export { DocumentValidationError, MAX_DOCUMENT_BYTES, MAX_MULTIPART_BYTES };
export class DocumentNotFoundError extends Error {}

export async function storeCaseDocument(caseFileId: string, file: File, actorUserId: string) {
  const inspected = await inspectDocumentUpload(file);
  const { buffer, originalName } = inspected;

  const caseFile = await prisma.caseFile.findFirst({ where: { id: caseFileId, archivedAt: null }, select: { referenceNumber: true } });
  if (!caseFile) throw new CaseNotFoundError();

  const token = randomBytes(32).toString("hex");
  const storageKey = `${token.slice(0, 2)}/${token}.${inspected.extension}`;
  const absolutePath = resolveStorageKey(storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const handle = await open(absolutePath, "wx", 0o600);

  try {
    await handle.writeFile(buffer);
  } finally {
    await handle.close();
  }

  try {
    const document = await prisma.$transaction(async (transaction) => {
      const activeCase = await transaction.caseFile.findFirst({ where: { id: caseFileId, archivedAt: null }, select: { id: true } });
      if (!activeCase) throw new CaseNotFoundError();
      const created = await transaction.caseDocument.create({
        data: {
          caseFileId,
          uploadedById: actorUserId,
          originalName,
          storageKey,
          mimeType: inspected.mimeType,
          sizeBytes: buffer.byteLength,
          sha256: inspected.sha256,
        },
        select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
      });
      await transaction.auditLog.create({
        data: { actorUserId, event: "case.document_uploaded", targetType: "case_file", targetId: caseFileId, context: { referenceNumber: caseFile.referenceNumber, documentId: created.id, mimeType: created.mimeType, sizeBytes: created.sizeBytes } },
      });
      return created;
    });
    return { ...document, createdAt: document.createdAt.toISOString() };
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }
}

export async function readCaseDocument(caseFileId: string, documentId: string) {
  const document = await prisma.caseDocument.findFirst({
    where: { id: documentId, caseFileId, caseFile: { archivedAt: null } },
    select: { originalName: true, storageKey: true, mimeType: true, sizeBytes: true },
  });
  if (!document) throw new DocumentNotFoundError();

  try {
    const data = await readFile(/* turbopackIgnore: true */ resolveStorageKey(document.storageKey));
    if (data.byteLength !== document.sizeBytes) throw new Error("Stored document size mismatch.");
    return { ...document, data };
  } catch (error) {
    if (error instanceof DocumentNotFoundError) throw error;
    console.error("Stored document could not be read", { error: error instanceof Error ? error.name : "UnknownError", documentId });
    throw new DocumentNotFoundError();
  }
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
