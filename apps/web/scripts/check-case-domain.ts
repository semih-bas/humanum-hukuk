import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";
import { buildDatabaseUrl } from "../src/lib/database-url";

config({ path: [".env.local", ".env.docker"], quiet: true });

const adapter = new PrismaPg({
  connectionString: buildDatabaseUrl("app"),
});
const prisma = new PrismaClient({ adapter });
const testPrefix = `CASE-DOMAIN-CHECK-${Date.now()}`;

async function expectDatabaseRejection(label: string, operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch {
    return label;
  }

  throw new Error(`Database accepted invalid case data: ${label}`);
}

try {
  const user = await prisma.user.findFirst({
    select: { id: true },
  });

  if (!user) {
    throw new Error("Case-domain check requires at least one existing user.");
  }

  const rollbackMarker = "ROLLBACK_CASE_DOMAIN_CHECK";

  try {
    await prisma.$transaction(async (transaction) => {
      const caseFile = await transaction.caseFile.create({
        data: {
          referenceNumber: `${testPrefix}-VALID`,
          licenseHolder: "Test Ruhsat Sahibi",
          vehiclePlate: "34 TEST 001",
          accidentDate: new Date("2026-01-15T00:00:00.000Z"),
          debtorType: "INSURANCE_COMPANY",
          debtorName: "Test Sigorta A.Ş.",
          damageAmount: 1000,
          depreciationAmount: 500,
          profitLossAmount: 250,
          discountAmount: 250,
          installmentCount: 3,
          status: "INSTALLMENT",
          createdById: user.id,
          updatedById: user.id,
          changes: {
            create: {
              changedById: user.id,
              changeType: "CREATED",
              newVersion: 1,
              snapshot: { referenceNumber: `${testPrefix}-VALID` },
            },
          },
          notes: {
            create: {
              authorId: user.id,
              content: "Geçici doğrulama notu",
            },
          },
          documents: {
            create: {
              uploadedById: user.id,
              originalName: "kontrol.pdf",
              storageKey: `${testPrefix}/kontrol.pdf`,
              mimeType: "application/pdf",
              sizeBytes: 128,
              sha256: "a".repeat(64),
            },
          },
          reminders: {
            create: {
              createdById: user.id,
              title: "Geçici doğrulama hatırlatması",
              dueAt: new Date("2026-02-15T09:00:00.000Z"),
              sendEmail: true,
              sendSms: false,
            },
          },
        },
        include: {
          changes: true,
          notes: true,
          documents: true,
          reminders: true,
        },
      });

      if (
        caseFile.changes.length !== 1
        || caseFile.notes.length !== 1
        || caseFile.documents.length !== 1
        || caseFile.reminders.length !== 1
      ) {
        throw new Error("Related case records were not created as expected.");
      }

      throw new Error(rollbackMarker);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== rollbackMarker) {
      throw error;
    }
  }

  const rolledBackCaseCount = await prisma.caseFile.count({
    where: { referenceNumber: `${testPrefix}-VALID` },
  });

  if (rolledBackCaseCount !== 0) {
    throw new Error("Temporary case-domain records were not rolled back.");
  }

  const [runtimePermissions] = await prisma.$queryRaw<
    Array<{ canDeleteCases: boolean; canRewriteHistory: boolean }>
  >`
    SELECT
      has_table_privilege(current_user, 'case_file', 'DELETE') AS "canDeleteCases",
      has_table_privilege(current_user, 'case_file_change', 'UPDATE') AS "canRewriteHistory"
  `;

  if (!runtimePermissions || runtimePermissions.canDeleteCases || runtimePermissions.canRewriteHistory) {
    throw new Error("Runtime database role can delete cases or rewrite case history.");
  }

  const rejectedInputs = await Promise.all([
    expectDatabaseRejection("negative amount", () => prisma.caseFile.create({
      data: {
        referenceNumber: `${testPrefix}-NEGATIVE`,
        licenseHolder: "Test",
        vehiclePlate: "34 TEST 002",
        accidentDate: new Date("2026-01-15T00:00:00.000Z"),
        debtorType: "COMPANY",
        damageAmount: -1,
        createdById: user.id,
        updatedById: user.id,
      },
    })),
    expectDatabaseRejection("unsupported installment count", () => prisma.caseFile.create({
      data: {
        referenceNumber: `${testPrefix}-INSTALLMENT`,
        licenseHolder: "Test",
        vehiclePlate: "34 TEST 003",
        accidentDate: new Date("2026-01-15T00:00:00.000Z"),
        debtorType: "INDIVIDUAL",
        installmentCount: 2,
        createdById: user.id,
        updatedById: user.id,
      },
    })),
    expectDatabaseRejection("discount above total claim", () => prisma.caseFile.create({
      data: {
        referenceNumber: `${testPrefix}-DISCOUNT`,
        licenseHolder: "Test",
        vehiclePlate: "34 TEST 004",
        accidentDate: new Date("2026-01-15T00:00:00.000Z"),
        debtorType: "INSURANCE_COMPANY",
        damageAmount: 100,
        discountAmount: 101,
        createdById: user.id,
        updatedById: user.id,
      },
    })),
  ]);

  const independentInstallments = await prisma.$transaction(async (transaction) => {
    const values = [
      { count: 6, status: "ENFORCEMENT" as const },
      { count: 12, status: "OPEN" as const },
      { count: null, status: "INSTALLMENT" as const },
    ];
    for (const value of values) {
      await transaction.caseFile.create({
        data: {
          referenceNumber: `${testPrefix}-INDEPENDENT-${value.count ?? "NONE"}`,
          licenseHolder: "Test",
          vehiclePlate: `34 TEST ${value.count ?? 999}`,
          accidentDate: new Date("2026-01-15T00:00:00.000Z"),
          debtorType: "INDIVIDUAL",
          installmentCount: value.count,
          status: value.status,
          createdById: user.id,
          updatedById: user.id,
        },
      });
    }
    throw new Error("ROLLBACK_CASE_DOMAIN_INSTALLMENT_CHECK");
  }).catch((error) => {
    if (!(error instanceof Error) || error.message !== "ROLLBACK_CASE_DOMAIN_INSTALLMENT_CHECK") throw error;
    return true;
  });

  console.log({
    status: "case-domain-valid",
    validRelations: ["change", "note", "document", "reminder"],
    rejectedInputs,
    independentInstallments,
    canDeleteCases: runtimePermissions.canDeleteCases,
    canRewriteHistory: runtimePermissions.canRewriteHistory,
    temporaryRecordsPersisted: false,
  });
} finally {
  await prisma.$disconnect();
}
