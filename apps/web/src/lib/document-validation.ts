import { createHash } from "node:crypto";
import path from "node:path";

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MAX_MULTIPART_BYTES = MAX_DOCUMENT_BYTES + 64 * 1024;

const allowedTypes = {
  "application/pdf": { extension: "pdf", signature: (data: Buffer) => data.subarray(0, 5).toString("ascii") === "%PDF-" },
  "image/jpeg": { extension: "jpg", signature: (data: Buffer) => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  "image/png": { extension: "png", signature: (data: Buffer) => data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
} as const;

export class DocumentValidationError extends Error {}

export type DocumentUpload = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export async function inspectDocumentUpload(file: DocumentUpload, requestedName?: string) {
  if (file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) throw new DocumentValidationError("Evrak 20 MB sınırını aşamaz ve boş olamaz.");

  const type = allowedTypes[file.type as keyof typeof allowedTypes];
  if (!type) throw new DocumentValidationError("Yalnızca PDF, JPG ve PNG evrakları yüklenebilir.");
  const originalName = buildDocumentName(file.name, requestedName, type.extension);

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength !== file.size || !type.signature(buffer)) throw new DocumentValidationError("Dosyanın içeriği bildirilen dosya türüyle eşleşmiyor.");

  return {
    originalName,
    mimeType: file.type,
    extension: type.extension,
    buffer,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

function buildDocumentName(fileName: string, requestedName: string | undefined, extension: string): string {
  if (requestedName !== undefined && /[<>:"/\\|?*\u0000-\u001f\u007f]/.test(requestedName)) {
    throw new DocumentValidationError("Evrak adı geçersiz karakter içeriyor.");
  }

  const fallback = sanitizeOriginalName(fileName).replace(/\.[^.]+$/, "");
  const baseName = (requestedName?.trim() || fallback).normalize("NFC").replace(/[. ]+$/g, "").slice(0, 240);
  if (!baseName || baseName === "." || baseName === "..") throw new DocumentValidationError("Evrak adı geçerli değil.");
  return `${baseName}.${extension}`;
}

function sanitizeOriginalName(value: string): string {
  const basename = path.win32.basename(path.posix.basename(value));
  return basename.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
}
