import { prisma } from "../src/lib/database";

const [type, identifier] = process.argv.slice(2);
if (!type || !identifier || !["icra", "sigorta", "genel", "kullanici"].includes(type)) throw new Error("Kullanım: npm run deletion:restore -- <icra|sigorta|genel|kullanici> <id|dosya-no|e-posta>");

try {
  if (type === "icra") {
    const record = await prisma.caseFile.findFirst({ where: { OR: [{ id: identifier }, { referenceNumber: identifier }], archivedAt: { not: null }, purgeAfter: { gt: new Date() } }, select: { id: true, referenceNumber: true } });
    if (!record) throw new Error("Geri getirilebilir icra dosyası bulunamadı.");
    await prisma.$transaction([prisma.caseFile.update({ where: { id: record.id }, data: { archivedAt: null, archivedById: null, purgeAfter: null } }), prisma.auditLog.create({ data: { actorUserId: null, event: "case_file.restored", targetType: "case_file", targetId: record.id, context: { referenceNumber: record.referenceNumber } } })]); console.log(`${record.referenceNumber} geri getirildi.`);
  } else if (type === "sigorta") {
    const record = await prisma.insuranceArbitrationCase.findFirst({ where: { OR: [{ id: identifier }, { referenceNumber: identifier }], archivedAt: { not: null }, purgeAfter: { gt: new Date() } }, select: { id: true, referenceNumber: true } });
    if (!record) throw new Error("Geri getirilebilir sigorta/tahkim dosyası bulunamadı.");
    await prisma.$transaction([prisma.insuranceArbitrationCase.update({ where: { id: record.id }, data: { archivedAt: null, archivedById: null, purgeAfter: null } }), prisma.auditLog.create({ data: { actorUserId: null, event: "insurance_arbitration_case.restored", targetType: "insurance_arbitration_case", targetId: record.id, context: { referenceNumber: record.referenceNumber } } })]); console.log(`${record.referenceNumber} geri getirildi.`);
  } else if (type === "genel") {
    const record = await prisma.generalLegalCase.findFirst({ where: { OR: [{ id: identifier }, { referenceNumber: identifier }], archivedAt: { not: null }, purgeAfter: { gt: new Date() } }, select: { id: true, referenceNumber: true } });
    if (!record) throw new Error("Geri getirilebilir genel dava/arabuluculuk dosyası bulunamadı.");
    await prisma.$transaction([prisma.generalLegalCase.update({ where: { id: record.id }, data: { archivedAt: null, archivedById: null, purgeAfter: null } }), prisma.auditLog.create({ data: { actorUserId: null, event: "general_legal_case.restored", targetType: "general_legal_case", targetId: record.id, context: { referenceNumber: record.referenceNumber } } })]); console.log(`${record.referenceNumber} geri getirildi.`);
  } else {
    const record = await prisma.user.findFirst({ where: { OR: [{ id: identifier }, { email: identifier.toLowerCase() }], deletionRequestedAt: { not: null }, deletionDueAt: { gt: new Date() } }, select: { id: true, email: true } });
    if (!record) throw new Error("Geri getirilebilir kullanıcı bulunamadı.");
    await prisma.$transaction([prisma.user.update({ where: { id: record.id }, data: { deletionRequestedAt: null, deletionDueAt: null, deletedById: null, banReason: "Yönetici tarafından pasifleştirildi" } }), prisma.auditLog.create({ data: { actorUserId: null, event: "user.deletion_cancelled", targetType: "user", targetId: record.id } })]); console.log(`${record.email} pasif kullanıcı olarak geri getirildi.`);
  }
} finally { await prisma.$disconnect(); }
