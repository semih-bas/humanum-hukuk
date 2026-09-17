import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function storeProfileImage(userId: string, type: keyof typeof imageExtensions, bytes: Uint8Array): Promise<void> {
  const root = profileImageRoot();
  const baseName = profileImageBaseName(userId);
  const extension = imageExtensions[type];
  const destination = path.join(/* turbopackIgnore: true */ root, `${baseName}.${extension}`);
  const temporary = path.join(/* turbopackIgnore: true */ root, `.${baseName}.${randomBytes(8).toString("hex")}.tmp`);

  await mkdir(root, { recursive: true });
  await writeFile(temporary, bytes, { mode: 0o600, flag: "wx" });
  try {
    await removeProfileImageFiles(root, baseName);
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

export async function readProfileImage(userId: string): Promise<{ data: Buffer; type: keyof typeof imageExtensions } | null> {
  const root = profileImageRoot();
  const baseName = profileImageBaseName(userId);
  for (const [type, extension] of Object.entries(imageExtensions) as Array<[keyof typeof imageExtensions, string]>) {
    try {
      return { data: await readFile(path.join(/* turbopackIgnore: true */ root, `${baseName}.${extension}`)), type };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

export async function removeProfileImage(userId: string): Promise<void> {
  await removeProfileImageFiles(profileImageRoot(), profileImageBaseName(userId));
}

function profileImageRoot(): string {
  const configured = process.env.DOCUMENT_STORAGE_PATH?.trim();
  if (!configured && process.env.NODE_ENV === "production") throw new Error("Missing required environment variable: DOCUMENT_STORAGE_PATH");
  const documentRoot = path.resolve(/* turbopackIgnore: true */ configured || path.join(process.cwd(), ".data", "documents"));
  return path.join(documentRoot, "profile-images");
}

function profileImageBaseName(userId: string): string {
  return createHash("sha256").update(userId).digest("hex");
}

async function removeProfileImageFiles(root: string, baseName: string): Promise<void> {
  await Promise.all(Object.values(imageExtensions).map((extension) => unlink(path.join(/* turbopackIgnore: true */ root, `${baseName}.${extension}`)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  })));
}
