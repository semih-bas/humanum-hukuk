import { config } from "dotenv";

config({ path: [".env.local", ".env.docker"], quiet: true });

const { prisma } = await import("../src/lib/database");
const { readJsonBody } = await import("../src/lib/api-security");
const { createCaseFileInTransaction } = await import("../src/lib/cases/create-case");
const { calculateCaseFinancials, createCaseSchema } = await import("../src/lib/cases/create-case-input");
const { POST } = await import("../src/app/api/cases/route");

const validPayload = {
  licenseHolder: "  Test   Ruhsat Sahibi  ",
  vehiclePlate: "34 test 001",
  accidentDate: "2026-01-15",
  debtorType: "INSURANCE_COMPANY",
  debtorName: "Test Sigorta A.Ş.",
  damageAmount: "1000.00",
  depreciationAmount: "500.00",
  profitLossAmount: "250.00",
  discountAmount: "250.00",
  enforcementOffice: "İstanbul 12. İcra Dairesi",
  enforcementFileNumber: `2026/${Date.now()}`,
  vehicleLien: true,
  bankLien: false,
  titleDeedLien: false,
  installmentCount: 3,
  status: "INSTALLMENT",
  note: "Geçici servis doğrulama notu",
  reminder: {
    title: "Geçici servis doğrulama hatırlatması",
    dueAt: "2099-02-15T09:00:00.000Z",
    sendEmail: true,
    sendSms: false,
  },
} as const;

async function expectRejectedValidation(label: string, payload: unknown): Promise<string> {
  if (createCaseSchema.safeParse(payload).success) {
    throw new Error(`Validation accepted invalid input: ${label}`);
  }

  return label;
}

try {
  const parsed = createCaseSchema.parse(validPayload);
  const financials = calculateCaseFinancials(parsed);

  if (
    financials.totalClaimAmount.toFixed(2) !== "1750.00"
    || financials.netClaimAmount.toFixed(2) !== "1500.00"
    || financials.monthlyInstallmentAmount?.toFixed(2) !== "500.00"
  ) {
    throw new Error("Server-side financial calculations are incorrect.");
  }

  const rejectedInputs = await Promise.all([
    expectRejectedValidation("negative amount", { ...validPayload, damageAmount: "-1" }),
    expectRejectedValidation("discount above total", { ...validPayload, discountAmount: "1750.01" }),
    expectRejectedValidation("claim total above database limit", {
      ...validPayload,
      damageAmount: "9999999999999999.99",
      depreciationAmount: "1.00",
    }),
    expectRejectedValidation("unsupported installment count", { ...validPayload, installmentCount: 2 }),
    expectRejectedValidation("installment without installment status", { ...validPayload, status: "OPEN" }),
    expectRejectedValidation("future accident date", { ...validPayload, accidentDate: "2099-01-15" }),
    expectRejectedValidation("partial enforcement identity", { ...validPayload, enforcementFileNumber: null }),
    expectRejectedValidation("reminder without delivery channel", {
      ...validPayload,
      reminder: { ...validPayload.reminder, sendEmail: false, sendSms: false },
    }),
    expectRejectedValidation("unknown input field", { ...validPayload, isAdmin: true }),
    expectRejectedValidation("control character in text", { ...validPayload, licenseHolder: "Test\nKişi" }),
  ]);

  const user = await prisma.user.findFirst({ select: { id: true } });

  if (!user) {
    throw new Error("Case-create check requires at least one existing user.");
  }

  const rollbackMarker = "ROLLBACK_CASE_CREATE_CHECK";
  let createdReferenceNumber: string | null = null;

  try {
    await prisma.$transaction(async (transaction) => {
      const result = await createCaseFileInTransaction(transaction, parsed, user.id);
      createdReferenceNumber = result.referenceNumber;

      if (!/^HH-\d{4}-\d{6}$/.test(result.referenceNumber)) {
        throw new Error("Generated case reference number has an invalid format.");
      }

      const stored = await transaction.caseFile.findUnique({
        where: { id: result.id },
        include: { changes: true, notes: true, reminders: true },
      });
      const audit = await transaction.auditLog.findFirst({
        where: { event: "case.created", targetId: result.id },
      });

      if (
        !stored
        || stored.vehiclePlate !== "34 TEST 001"
        || stored.changes.length !== 1
        || stored.notes.length !== 1
        || stored.reminders.length !== 1
        || !audit
      ) {
        throw new Error("Atomic case creation did not persist every expected related record.");
      }

      throw new Error(rollbackMarker);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== rollbackMarker) {
      throw error;
    }
  }

  if (!createdReferenceNumber) {
    throw new Error("Case creation test did not produce a reference number.");
  }

  const persistedTestRecords = await prisma.caseFile.count({
    where: { referenceNumber: createdReferenceNumber },
  });

  if (persistedTestRecords !== 0) {
    throw new Error("Temporary case-create test record was not rolled back.");
  }

  const invalidOriginResponse = await POST(new Request("http://localhost:3000/api/cases", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.invalid",
    },
    body: JSON.stringify(validPayload),
  }));

  if (invalidOriginResponse.status !== 403) {
    throw new Error(`Invalid origin returned ${invalidOriginResponse.status} instead of 403.`);
  }

  const unauthorizedResponse = await POST(new Request("http://localhost:3000/api/cases", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: process.env.BETTER_AUTH_URL!,
    },
    body: JSON.stringify(validPayload),
  }));

  if (unauthorizedResponse.status !== 401) {
    throw new Error(`Unauthenticated request returned ${unauthorizedResponse.status} instead of 401.`);
  }

  const oversizedRequest = new Request("http://localhost:3000/api/cases", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(33 * 1024) }),
  });

  let oversizedRejected = false;

  try {
    await readJsonBody(oversizedRequest);
  } catch (error) {
    oversizedRejected = error instanceof Error && "status" in error && error.status === 413;
  }

  if (!oversizedRejected) {
    throw new Error("Oversized JSON request was not rejected.");
  }

  console.log({
    status: "case-create-valid",
    calculatedFinancials: {
      total: financials.totalClaimAmount.toFixed(2),
      net: financials.netClaimAmount.toFixed(2),
      monthlyInstallment: financials.monthlyInstallmentAmount?.toFixed(2),
    },
    rejectedInputs,
    invalidOriginStatus: invalidOriginResponse.status,
    unauthorizedStatus: unauthorizedResponse.status,
    oversizedRequestRejected: oversizedRejected,
    atomicRelations: ["change", "note", "reminder", "audit_log"],
    temporaryRecordsPersisted: false,
  });
} finally {
  await prisma.$disconnect();
}
