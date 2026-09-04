export class DocumentQuotaExceededError extends Error {
  constructor(public readonly code: "CASE_DOCUMENT_LIMIT" | "STORAGE_QUOTA_EXCEEDED", message: string) {
    super(message);
  }
}

export type DocumentStorageLimits = {
  maxDocumentsPerCase: number;
  maxStorageBytes: number;
  maxUploadsPerUserHour: number;
};

function integerEnvironment(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }
  return value;
}

export function documentStorageLimits(): DocumentStorageLimits {
  return {
    maxDocumentsPerCase: integerEnvironment("DOCUMENT_MAX_PER_CASE", 100, 10_000),
    maxStorageBytes: integerEnvironment("DOCUMENT_STORAGE_QUOTA_BYTES", 5 * 1024 * 1024 * 1024, Number.MAX_SAFE_INTEGER),
    maxUploadsPerUserHour: integerEnvironment("DOCUMENT_UPLOADS_PER_USER_HOUR", 20, 10_000),
  };
}

export function assertDocumentQuota(
  usage: { caseDocumentCount: number; storedBytes: number },
  incomingBytes: number,
  limits: DocumentStorageLimits,
): void {
  if (usage.caseDocumentCount >= limits.maxDocumentsPerCase) {
    throw new DocumentQuotaExceededError("CASE_DOCUMENT_LIMIT", "Bu dosya için evrak sayısı sınırına ulaşıldı.");
  }
  if (usage.storedBytes + incomingBytes > limits.maxStorageBytes) {
    throw new DocumentQuotaExceededError("STORAGE_QUOTA_EXCEEDED", "Evrak depolama kotası doldu. Yöneticinizle iletişime geçin.");
  }
}
