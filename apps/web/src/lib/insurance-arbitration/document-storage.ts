import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/database";
import { hasExpectedDocumentDigest } from "@/lib/document-integrity";
import { inspectDocumentUpload } from "@/lib/document-validation";

export class InsuranceDocumentNotFoundError extends Error {}

export async function storeInsuranceDocument(caseId: string, file: File, actorUserId: string) {
  const inspected = await inspectDocumentUpload(file);
  const token = randomBytes(32).toString("hex");
  const storageKey = `insurance/${token.slice(0, 2)}/${token}.${inspected.extension}`;
  const absolutePath = resolveStorageKey(storageKey);
  let created = false;
  try {
    const activeCase = await prisma.insuranceArbitrationCase.findUnique({ where: { id: caseId }, select: { id: true } });
    if (!activeCase) throw new InsuranceDocumentNotFoundError();
    await mkdir(path.dirname(absolutePath), { recursive: true });
    const handle = await open(absolutePath, "wx", 0o600);
    created = true;
    try { await handle.writeFile(inspected.buffer); } finally { await handle.close(); }
    const document = await prisma.insuranceArbitrationDocument.create({ data: { caseId, uploadedById: actorUserId, originalName: inspected.originalName, storageKey, mimeType: inspected.mimeType, sizeBytes: inspected.buffer.byteLength, sha256: inspected.sha256 }, select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } });
    return { ...document, createdAt: document.createdAt.toISOString() };
  } catch (error) {
    if (created) await unlink(absolutePath).catch(() => undefined);
    throw error;
  }
}

export async function readInsuranceDocument(caseId: string, documentId: string) {
  const document = await prisma.insuranceArbitrationDocument.findFirst({ where: { id: documentId, caseId }, select: { originalName: true, storageKey: true, mimeType: true, sizeBytes: true, sha256: true } });
  if (!document) throw new InsuranceDocumentNotFoundError();
  try {
    const data = await readFile(/* turbopackIgnore: true */ resolveStorageKey(document.storageKey));
    if (data.byteLength !== document.sizeBytes || !hasExpectedDocumentDigest(data, document.sha256)) throw new Error("Invalid document data");
    return { ...document, data };
  } catch { throw new InsuranceDocumentNotFoundError(); }
}

function storageRoot() {
  const configured = process.env.DOCUMENT_STORAGE_PATH?.trim();
  if (!configured && process.env.NODE_ENV === "production") throw new Error("Missing required environment variable: DOCUMENT_STORAGE_PATH");
  return path.resolve(/* turbopackIgnore: true */ configured || path.join(process.cwd(), ".data", "documents"));
}

function resolveStorageKey(storageKey: string) {
  if (!/^insurance\/[a-f0-9]{2}\/[a-f0-9]{64}\.(?:pdf|jpg|png)$/.test(storageKey)) throw new InsuranceDocumentNotFoundError();
  const root = storageRoot(); const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new InsuranceDocumentNotFoundError();
  return resolved;
}
