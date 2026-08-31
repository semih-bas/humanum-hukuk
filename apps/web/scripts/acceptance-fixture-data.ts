import { createHash } from "node:crypto";

export const DEFAULT_ACCEPTANCE_FIXTURE_BATCH = "HH-ACC-20260831-V1";
export const FIXTURE_COUNTS = {
  users: 10,
  cases: 30,
  notesPerCase: 3,
  remindersPerCase: 2,
  documentsPerCase: 2,
  changesPerCase: 2,
} as const;

const statuses = ["OPEN", "ENFORCEMENT", "INSTALLMENT", "PENDING", "CLOSED"] as const;
const debtorTypes = ["INSURANCE_COMPANY", "INDIVIDUAL", "COMPANY"] as const;
const reminderStatuses = ["PENDING", "SENT", "FAILED", "CANCELLED"] as const;
const installmentCounts = [3, 4, 6, 9, 12] as const;

export type FixtureUser = ReturnType<typeof buildFixtureUsers>[number];
export type FixtureCase = ReturnType<typeof buildFixtureCases>[number];

export function readFixtureBatchId(): string {
  const batchId = process.env.ACCEPTANCE_FIXTURE_BATCH?.trim() || DEFAULT_ACCEPTANCE_FIXTURE_BATCH;
  if (!/^[A-Z0-9][A-Z0-9-]{7,63}$/.test(batchId)) {
    throw new Error("Acceptance fixture batch must contain 8-64 uppercase letters, numbers or hyphens.");
  }
  return batchId;
}

export function assertAcceptanceFixtureEnvironment(): void {
  if (process.env.ACCEPTANCE_FIXTURE_ALLOWED !== "true") {
    throw new Error("Acceptance fixture tooling is disabled. Set ACCEPTANCE_FIXTURE_ALLOWED=true in the tools service only.");
  }

  const migrationUrl = requiredUrl("MIGRATION_DATABASE_URL");
  const authUrl = requiredUrl("BETTER_AUTH_URL");
  const storagePath = process.env.DOCUMENT_STORAGE_PATH?.trim();

  if (migrationUrl.hostname !== "database" || !migrationUrl.pathname.endsWith("_acceptance")) {
    throw new Error("Acceptance fixtures may only target the Docker acceptance database.");
  }
  if (authUrl.origin !== "http://localhost:3001") {
    throw new Error("Acceptance fixtures may only run for the localhost acceptance application.");
  }
  if (storagePath !== "/var/lib/humanum/documents") {
    throw new Error("Acceptance fixture document storage path is not the expected isolated volume.");
  }
}

export function fixturePrefixes(batchId: string) {
  const root = `fixture:${batchId}:`;
  return {
    root,
    user: `${root}user:`,
    account: `${root}account:`,
    caseFile: `${root}case:`,
    change: `${root}change:`,
    note: `${root}note:`,
    reminder: `${root}reminder:`,
    document: `${root}document:`,
    audit: `${root}audit:`,
  };
}

export function buildAcceptanceFixtureDataset(batchId: string) {
  const users = buildFixtureUsers(batchId);
  const cases = buildFixtureCases(batchId, users);
  return { batchId, users, cases };
}

function buildFixtureUsers(batchId: string) {
  const names = [
    "Deniz Ada Yılmaz",
    "Ekin Su Demir",
    "Mert Can Kaya",
    "Selin Naz Arslan",
    "Bora Alp Şahin",
    "İpek Ela Koç",
    "Umut Efe Aydın",
    "Duru Lina Çelik",
    "Arda Eren Aksoy",
    "Nehir Ece Yalçın",
  ];
  const prefixes = fixturePrefixes(batchId);
  const emailBatch = batchId.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return names.map((baseName, index) => {
    const ordinal = String(index + 1).padStart(2, "0");
    const longSuffix = index === names.length - 1
      ? " Sentetik Kabul Testi Kullanıcısı Çok Uzun İsim ve Soyisim Taşması Kontrol Kaydı"
      : "";
    return {
      id: `${prefixes.user}${ordinal}`,
      accountId: `${prefixes.account}${ordinal}`,
      name: `${baseName}${longSuffix}`.slice(0, 145),
      email: `kullanici${ordinal}.${emailBatch}@example.invalid`,
      role: index < 2 ? "admin" : "user",
      emailVerified: index !== 8,
      banned: index === 7,
      banReason: index === 7 ? `Sentetik test hesabı devre dışı senaryosu (${batchId})` : null,
      createdAt: new Date(Date.UTC(2026, 7, 1, 7, index, 0)),
    };
  });
}

function buildFixtureCases(batchId: string, users: ReturnType<typeof buildFixtureUsers>) {
  const prefixes = fixturePrefixes(batchId);
  const licenseHolders = [
    "Mavi Ufuklar Lojistik Sanayi ve Ticaret Anonim Şirketi",
    "Kuzey Rüzgârı Enerji Sistemleri Mühendislik Danışmanlık Limited Şirketi",
    "Güneşli Vadi Tarım Teknolojileri Üretim Pazarlama ve Dış Ticaret Anonim Şirketi",
    "Örnek Sentetik Ruhsat Sahibi",
    "Yeni Nesil Şehir İçi Dağıtım ve Mobilite Hizmetleri Limited Şirketi",
  ];
  const debtorNames = [
    "Örnek Güvence Sigorta Anonim Şirketi",
    "Sentetik Borçlu Kişi",
    "Kurgusal Kurumsal Çözümler Sanayi ve Ticaret Limited Şirketi",
  ];

  return Array.from({ length: FIXTURE_COUNTS.cases }, (_, index) => {
    const ordinal = String(index + 1).padStart(3, "0");
    const status = statuses[index % statuses.length];
    const debtorType = debtorTypes[index % debtorTypes.length];
    const actor = users[index % 7];
    const accidentMonth = String((index % 12) + 1).padStart(2, "0");
    const accidentDay = String((index % 27) + 1).padStart(2, "0");
    const longHolder = index % 10 === 9
      ? `${licenseHolders[index % licenseHolders.length]} Bölge Müdürlüğü Operasyon Merkezi Uzun Unvan Görünüm Kontrolü`
      : licenseHolders[index % licenseHolders.length];
    const damageAmount = `${50_000 + index * 17_531}.${String((index * 13) % 100).padStart(2, "0")}`;
    const depreciationAmount = `${8_500 + index * 2_407}.${String((index * 7) % 100).padStart(2, "0")}`;
    const profitLossAmount = `${3_250 + index * 1_903}.${String((index * 11) % 100).padStart(2, "0")}`;
    const discountAmount = `${index % 4 === 0 ? 0 : 1_000 + index * 173}.${String((index * 5) % 100).padStart(2, "0")}`;
    const enforcement = index % 3 !== 0;
    const installmentCount = status === "INSTALLMENT"
      ? installmentCounts[index % installmentCounts.length]
      : index % 4 === 0 ? installmentCounts[index % installmentCounts.length] : null;
    const createdAt = new Date(Date.UTC(2026, 7, 2 + index, 8, index % 60, 0));
    const caseFile = {
      id: `${prefixes.caseFile}${ordinal}`,
      referenceNumber: `HH-2026-${String(900_001 + index).padStart(6, "0")}`,
      licenseHolder: longHolder.slice(0, 150),
      vehiclePlate: index % 10 === 8 ? `34 TEST PLAKA ${ordinal}` : `34 TST ${String(1000 + index)}`,
      accidentDate: `2025-${accidentMonth}-${accidentDay}`,
      debtorType,
      debtorName: `${debtorNames[index % debtorNames.length]} ${index + 1}`.slice(0, 150),
      damageAmount,
      depreciationAmount,
      profitLossAmount,
      discountAmount,
      enforcementOffice: enforcement
        ? `İstanbul ${10 + (index % 20)}. İcra Dairesi ${index % 7 === 6 ? "Uzun Müdürlük ve Birim Adı Görünüm Kontrolü" : ""}`.trim().slice(0, 150)
        : null,
      enforcementFileNumber: enforcement ? `2026/${80_000 + index}-${batchId.slice(-4)}` : null,
      vehicleLien: index % 2 === 0,
      bankLien: index % 3 === 0,
      titleDeedLien: index % 5 === 0,
      installmentCount,
      status,
      version: 2,
      createdById: actor.id,
      updatedById: users[(index + 1) % 7].id,
      createdAt,
    };

    return {
      ...caseFile,
      changes: buildChanges(prefixes.change, ordinal, caseFile, batchId),
      notes: buildNotes(prefixes.note, ordinal, caseFile.id, users, index, batchId, createdAt),
      reminders: buildReminders(prefixes.reminder, ordinal, caseFile.id, users, index, batchId),
      documents: buildDocuments(prefixes.document, ordinal, caseFile.id, actor.id, index, batchId, createdAt),
    };
  });
}

function buildChanges(prefix: string, ordinal: string, caseFile: Record<string, unknown>, batchId: string) {
  const actorId = String(caseFile.createdById);
  const updatedById = String(caseFile.updatedById);
  const createdAt = caseFile.createdAt as Date;
  const snapshot = {
    fixtureBatchId: batchId,
    referenceNumber: caseFile.referenceNumber,
    licenseHolder: caseFile.licenseHolder,
    vehiclePlate: caseFile.vehiclePlate,
    status: caseFile.status,
    damageAmount: caseFile.damageAmount,
    depreciationAmount: caseFile.depreciationAmount,
    profitLossAmount: caseFile.profitLossAmount,
    discountAmount: caseFile.discountAmount,
  };
  return [
    {
      id: `${prefix}${ordinal}:01`,
      changedById: actorId,
      changeType: "CREATED" as const,
      previousVersion: null,
      newVersion: 1,
      changedFields: Object.keys(snapshot),
      snapshot,
      createdAt,
    },
    {
      id: `${prefix}${ordinal}:02`,
      changedById: updatedById,
      changeType: "UPDATED" as const,
      previousVersion: 1,
      newVersion: 2,
      changedFields: ["status", "fixtureBatchId"],
      snapshot: { ...snapshot, fixtureBatchId: batchId, version: 2 },
      createdAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
    },
  ];
}

function buildNotes(prefix: string, ordinal: string, caseFileId: string, users: FixtureUser[], caseIndex: number, batchId: string, createdAt: Date) {
  const longText = (`${batchId} sentetik uzun not kontrolü. Araç hasarı, değer kaybı, iletişim süreci ve evrak incelemesine ilişkin tamamen kurgusal açıklama. `).repeat(18).slice(0, 1_850);
  const contents = [
    `${batchId} — Dosya ilk inceleme notu. Bu kayıt yalnızca acceptance testi için oluşturulmuştur.`,
    caseIndex % 4 === 0 ? longText : `${batchId} — Kurgusal taraf görüşmesi tamamlandı; eksik evrak listesi sentetik olarak güncellendi.`,
    `${batchId} — Türkçe karakter kontrolü: ğüşiöç İĞÜŞÖÇ. Satır taşması ve okunabilirlik senaryosu ${caseIndex + 1}.`,
  ];
  return contents.map((content, noteIndex) => ({
    id: `${prefix}${ordinal}:${String(noteIndex + 1).padStart(2, "0")}`,
    caseFileId,
    authorId: users[(caseIndex + noteIndex) % 7].id,
    content,
    createdAt: new Date(createdAt.getTime() + (noteIndex + 1) * 20 * 60 * 1000),
  }));
}

function buildReminders(prefix: string, ordinal: string, caseFileId: string, users: FixtureUser[], caseIndex: number, batchId: string) {
  return Array.from({ length: FIXTURE_COUNTS.remindersPerCase }, (_, reminderIndex) => {
    const status = reminderStatuses[(caseIndex * 2 + reminderIndex) % reminderStatuses.length];
    const dueAt = status === "PENDING"
      ? new Date(Date.UTC(2026, 8, 5 + caseIndex, 7 + reminderIndex, 30, 0))
      : new Date(Date.UTC(2026, 7, 5 + caseIndex, 7 + reminderIndex, 30, 0));
    const longTitle = caseIndex % 9 === 8 && reminderIndex === 1
      ? (`${batchId} uzun hatırlatma başlığı ve görünüm kontrolü `).repeat(7).slice(0, 420)
      : `${batchId} — ${reminderIndex === 0 ? "Evrak kontrolü" : "Kurgusal dosya takip görüşmesi"}`;
    return {
      id: `${prefix}${ordinal}:${String(reminderIndex + 1).padStart(2, "0")}`,
      caseFileId,
      createdById: users[(caseIndex + reminderIndex) % 7].id,
      title: longTitle,
      dueAt,
      sendEmail: true,
      sendSms: false,
      status,
      sentAt: status === "SENT" ? new Date(dueAt.getTime() + 5 * 60 * 1000) : null,
    };
  });
}

function buildDocuments(prefix: string, ordinal: string, caseFileId: string, uploadedById: string, caseIndex: number, batchId: string, createdAt: Date) {
  return Array.from({ length: FIXTURE_COUNTS.documentsPerCase }, (_, documentIndex) => {
    const pdf = documentIndex === 0;
    const extension = pdf ? "pdf" : "png";
    const mimeType = pdf ? "application/pdf" : "image/png";
    const content = pdf
      ? createFixturePdf(`${batchId} synthetic case ${caseIndex + 1}`)
      : Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    const token = createHash("sha256").update(`${batchId}:document:${ordinal}:${documentIndex}`).digest("hex");
    const nameBase = caseIndex % 8 === 7 && documentIndex === 0
      ? (`${batchId}-sentetik-uzun-evrak-adi-kontrol-`).repeat(6).slice(0, 220)
      : `${batchId}-dosya-${ordinal}-${documentIndex === 0 ? "kaza-tespit-tutanagi" : "hasar-fotografi"}`;
    return {
      id: `${prefix}${ordinal}:${String(documentIndex + 1).padStart(2, "0")}`,
      caseFileId,
      uploadedById,
      originalName: `${nameBase}.${extension}`,
      storageKey: `${token.slice(0, 2)}/${token}.${extension}`,
      mimeType,
      sizeBytes: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
      content,
      createdAt: new Date(createdAt.getTime() + (documentIndex + 1) * 30 * 60 * 1000),
    };
  });
}

export function createFixturePdf(label: string): Buffer {
  const safeLabel = label.replace(/[^A-Za-z0-9 .:_-]/g, "").slice(0, 120);
  const stream = `BT /F1 12 Tf 72 720 Td (${safeLabel}) Tj ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj\n`,
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(output));
    output += object;
  }
  const xrefOffset = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, "ascii");
}

function requiredUrl(name: string): URL {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required acceptance fixture environment variable: ${name}`);
  return new URL(value);
}
