import "server-only";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/database";

type PurgeResult = { enforcement: number; insurance: number; general: number; users: number; documentsRemoved: number };

export async function purgeExpiredDeletions(now = new Date()): Promise<PurgeResult> {
  const [enforcement, insurance, general, users] = await Promise.all([
    prisma.caseFile.findMany({ where: { purgeAfter: { lte: now } }, take: 100, select: { id: true, documents: { select: { storageKey: true } } } }),
    prisma.insuranceArbitrationCase.findMany({ where: { purgeAfter: { lte: now } }, take: 100, select: { id: true, documents: { select: { storageKey: true } } } }),
    prisma.generalLegalCase.findMany({ where: { purgeAfter: { lte: now } }, take: 100, select: { id: true, documents: { select: { storageKey: true } } } }),
    prisma.user.findMany({ where: { deletionDueAt: { lte: now }, deletionRequestedAt: { not: null } }, take: 100, select: { id: true } }),
  ]);
  const storageKeys = [...enforcement, ...insurance, ...general].flatMap((record) => record.documents.map((document) => document.storageKey));
  await prisma.$transaction(async (transaction) => {
    if (enforcement.length) await transaction.caseFile.deleteMany({ where: { id: { in: enforcement.map((record) => record.id) }, purgeAfter: { lte: now } } });
    if (insurance.length) await transaction.insuranceArbitrationCase.deleteMany({ where: { id: { in: insurance.map((record) => record.id) }, purgeAfter: { lte: now } } });
    if (general.length) await transaction.generalLegalCase.deleteMany({ where: { id: { in: general.map((record) => record.id) }, purgeAfter: { lte: now } } });
    for (const user of users) {
      await transaction.session.deleteMany({ where: { userId: user.id } });
      await transaction.account.deleteMany({ where: { userId: user.id } });
      await transaction.user.update({ where: { id: user.id }, data: { name: "Silinmiş Kullanıcı", email: `deleted.${user.id}@invalid.local`, emailVerified: false, image: null, role: "deleted", mustChangePassword: false, banned: true, banReason: "Kişisel verileri silindi", banExpires: null, deletionDueAt: null } });
      await transaction.auditLog.create({ data: { actorUserId: null, event: "user.personal_data_purged", targetType: "user", targetId: user.id } });
    }
  });
  let documentsRemoved = 0;
  for (const storageKey of storageKeys) {
    const target = safeDocumentPath(storageKey);
    if (!target) continue;
    await unlink(target).then(() => { documentsRemoved += 1; }).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") console.error("Deleted record document cleanup failed", { storageKey, code: error.code }); });
  }
  return { enforcement: enforcement.length, insurance: insurance.length, general: general.length, users: users.length, documentsRemoved };
}

function safeDocumentPath(storageKey: string) {
  if (!/^(?:(?:insurance|general)\/)?[a-f0-9]{2}\/[a-f0-9]{64}\.(?:pdf|jpg|png)$/.test(storageKey)) return null;
  const configured = process.env.DOCUMENT_STORAGE_PATH?.trim();
  if (!configured) return null;
  const root = path.resolve(configured); const target = path.resolve(root, storageKey);
  return target.startsWith(`${root}${path.sep}`) ? target : null;
}
