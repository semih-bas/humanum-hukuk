import { createHash, timingSafeEqual } from "node:crypto";

export function hasExpectedDocumentDigest(data: Buffer, expectedSha256: string): boolean {
  const actualDigest = createHash("sha256").update(data).digest();
  const expectedDigest = Buffer.from(expectedSha256, "hex");
  return expectedDigest.byteLength === actualDigest.byteLength && timingSafeEqual(expectedDigest, actualDigest);
}
