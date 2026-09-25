"use client";

import AppShell from "@/components/app-shell/AppShell";
import { formatMoneyInput, limitDateYear, parseMoneyToCents } from "@/lib/form-input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import FinanceStep, { type FinanceDraft, type FinancialEntryDraft } from "./FinanceStep";
import DocumentsStep, { type DocumentDraft, type DocumentFolderConfig } from "./DocumentsStep";
import partyStyles from "./PartyStep.module.css";
import ProcessStep, { type HearingDraft, type ProcessEntryDraft } from "./ProcessStep";
import TaskStep, { type TaskDraft } from "./TaskStep";
import NoteStep, { type NoteDraft } from "./NoteStep";
import styles from "./page.module.css";

const steps = ["Genel Bilgiler", "Taraflar", "Mali Bilgiler", "Dava Süreci", "Evraklar", "Bildirimler", "Notlar"];
const stages = [
  ["CASE_OPENING", "Dava Açılışı"], ["NOTIFICATION", "Tebligat"], ["RESPONSE_PETITION", "Cevap Dilekçesi"],
  ["PRELIMINARY_REVIEW", "Ön İnceleme"], ["EXAMINATION", "Tahkikat"], ["EXPERT_REPORT", "Bilirkişi Raporu"],
  ["HEARING", "Duruşma"], ["DECISION", "Karar"], ["APPEAL", "İstinaf"], ["CASSATION", "Yargıtay"],
  ["FINALIZATION", "Kesinleşme"], ["COLLECTION", "Tahsilat"], ["CLOSED", "Dosya Kapanışı"],
] as const;

const initialForm = {
  kind: "GENERAL_LITIGATION", caseType: "", subject: "", openingDate: currentIstanbulDate(), caseValue: "0",
  uyapMainNumber: "", uyapDecisionNumber: "", courthouse: "", courtType: "", court: "", status: "ACTIVE",
  stage: "CASE_OPENING", procedure: "", urgent: false, confidentiality: "NORMAL", estimatedCompletionDate: "",
  trackingGroup: "", tags: "", office: "", description: "",
};
const initialFinance: FinanceDraft = {
  claimAmount: "0", amendmentAmount: "0", interestRequested: false, interestStartDate: "",
  expectedCollectionAmount: "0", opposingAttorneyFee: "0", paymentPlan: "CASH", installmentCount: "3",
  financeDescription: "",
};
export type GeneralCaseDraft = typeof initialForm;
type PartyDraft = {
  clientId: string; role: string; kind: "INDIVIDUAL" | "ORGANIZATION"; name: string; identityOrTaxNumber: string;
  phone: string; email: string; address: string; representativeName: string; clientType: string; description: string;
};

export type WizardInitialData = {
  legalCase: GeneralCaseDraft & {
    id: string; version: number; referenceNumber: string; tags: string[]; responsibleUserId: string; fileStaffUserId: string | null;
    documentFolders: DocumentFolderConfig[];
    parties: Array<Omit<PartyDraft, "clientId"> & { id: string; identityOrTaxNumber: string | null; phone: string | null; email: string | null; address: string | null; representativeName: string | null; clientType: string | null; description: string | null }>;
  };
  finance: FinanceDraft & {
    installmentCount: number | null; financeDescription: string | null; interestStartDate: string | null;
    entries: Array<{ id: string; type: FinancialEntryDraft["type"]; category: string; entryDate: string; amount: string; description: string }>;
  };
  process: {
    processEntries: Array<{ id: string; type: ProcessEntryDraft["type"]; stage: string; eventDate: string; action: string; description: string | null; responsibleUser: { id: string; name: string } | null }>;
    hearings: Array<{ id: string; startsAt: string; court: string; hearingType: string; courtroom: string | null; attendeeUser: { id: string; name: string } | null; reminderOffsetMinutes: number | null; note: string | null; status: HearingDraft["status"] }>;
  };
  tasks: Array<{ id: string; title: string; description: string | null; priority: TaskDraft["priority"]; dueAt: string; taskType: string | null; reminderOffsetMinutes: number | null; status: TaskDraft["status"]; assignee: { id: string; name: string } | null; createdBy: { name: string } }>;
  notes: Array<{ id: string; content: string; noteType: NoteDraft["noteType"]; visibility: NoteDraft["visibility"]; important: boolean }>;
  documents: Array<{ id: string; originalName: string; category: string; folderKey: string | null; mimeType: string; sizeBytes: number }>;
};

export default function GeneralCaseWizard({ currentUser, initialData = null, readOnly = false }: { currentUser: { id: string; name: string }; initialData?: WizardInitialData | null; readOnly?: boolean }) {
  const router = useRouter();
  const editingCase = initialData?.legalCase ?? null;
  const [form, setForm] = useState<GeneralCaseDraft>(() => editingCase ? {
    ...initialForm, ...editingCase, openingDate: editingCase.openingDate ?? initialForm.openingDate, tags: editingCase.tags.join(", "), estimatedCompletionDate: editingCase.estimatedCompletionDate ?? "",
    uyapMainNumber: editingCase.uyapMainNumber ?? "", uyapDecisionNumber: editingCase.uyapDecisionNumber ?? "", courthouse: editingCase.courthouse ?? "",
    courtType: editingCase.courtType ?? "", court: editingCase.court ?? "", procedure: editingCase.procedure ?? "", trackingGroup: editingCase.trackingGroup ?? "",
    office: editingCase.office ?? "", description: editingCase.description ?? "",
  } : initialForm);
  const [step, setStep] = useState(0);
  const [parties, setParties] = useState<PartyDraft[]>(() => editingCase ? editingCase.parties.map((party) => ({ ...party, clientId: party.id, identityOrTaxNumber: party.identityOrTaxNumber ?? "", phone: (party.phone ?? "").replace(/\D/g, "").slice(0, 11), email: party.email ?? "", address: party.address ?? "", representativeName: party.representativeName ?? "", clientType: party.clientType ?? "", description: party.description ?? "" })) : primaryParties("GENERAL_LITIGATION"));
  const [finance, setFinance] = useState<FinanceDraft>(() => initialData ? { ...initialFinance, ...initialData.finance, installmentCount: String(initialData.finance.installmentCount ?? 3), financeDescription: initialData.finance.financeDescription ?? "", interestStartDate: initialData.finance.interestStartDate ?? "" } : initialFinance);
  const [financialEntries, setFinancialEntries] = useState<FinancialEntryDraft[]>(() => initialData?.finance.entries?.map((entry: { id: string; type: FinancialEntryDraft["type"]; category: string; entryDate: string; amount: string; description: string }) => ({ clientId: entry.id, type: entry.type, category: entry.category, entryDate: entry.entryDate, amount: entry.amount, description: entry.description })) ?? []);
  const [processEntries, setProcessEntries] = useState<ProcessEntryDraft[]>(() => initialData?.process.processEntries.map((entry) => ({ clientId: entry.id, type: entry.type, stage: entry.stage, eventDate: entry.eventDate, action: entry.action, description: entry.description ?? "", responsibleUserId: entry.responsibleUser?.id ?? null })) ?? []);
  const [hearings, setHearings] = useState<HearingDraft[]>(() => initialData?.process.hearings.map((hearing) => ({ clientId: hearing.id, startsAt: toLocalDateTime(hearing.startsAt), court: hearing.court, hearingType: hearing.hearingType, courtroom: hearing.courtroom ?? "", attendeeUserId: hearing.attendeeUser?.id ?? null, reminderOffsetMinutes: hearing.reminderOffsetMinutes, note: hearing.note ?? "", status: hearing.status })) ?? []);
  const [documents, setDocuments] = useState<DocumentDraft[]>(() => initialData?.documents.map((document) => ({ clientId: document.id, persistedId: document.id, file: null, originalName: document.originalName, mimeType: document.mimeType, sizeBytes: document.sizeBytes, category: document.category, folder: document.folderKey ?? document.category })) ?? []);
  const [documentFolders, setDocumentFolders] = useState<DocumentFolderConfig[]>(() => initialData?.legalCase.documentFolders ?? []);
  const [tasks, setTasks] = useState<TaskDraft[]>(() => initialData?.tasks.map((task) => ({ clientId: task.id, title: task.title, description: task.description ?? "", assigneeUserId: task.assignee?.id ?? null, priority: task.priority, dueAt: toLocalDateTime(task.dueAt), taskType: task.taskType ?? "", reminderOffsetMinutes: task.reminderOffsetMinutes, status: task.status, creatorName: task.createdBy.name })) ?? []);
  const [notes, setNotes] = useState<NoteDraft[]>(() => initialData?.notes.map((note) => ({ clientId: note.id, content: note.content, noteType: note.noteType, visibility: note.visibility, important: note.important })) ?? []);
  const [createdCase, setCreatedCase] = useState<{ id: string; referenceNumber: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [partyDraft, setPartyDraft] = useState<PartyDraft>(() => makeParty("THIRD_PARTY"));
  const [partyModalErrors, setPartyModalErrors] = useState<string[]>([]);
  const partyNameRef = useRef<HTMLInputElement>(null);
  const partyIdentityRef = useRef<HTMLInputElement>(null);
  function update(name: keyof GeneralCaseDraft, value: string | boolean) { setForm((current) => ({ ...current, [name]: value })); setMissingFields((current) => current.filter((label) => generalFieldLabel(name) !== label)); }
  function updateKind(value: string) { setForm((current) => ({ ...current, kind: value })); setParties(primaryParties(value)); }
  function updateStatus(value: string) { setForm((current) => ({ ...current, status: value, stage: value === "CLOSED" ? "CLOSED" : current.stage === "CLOSED" ? "CASE_OPENING" : current.stage })); }
  function updateStage(value: string) { setForm((current) => ({ ...current, stage: value, status: value === "CLOSED" ? "CLOSED" : current.status === "CLOSED" ? "ACTIVE" : current.status })); }
  function continueToParties(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!validateStep(0)) return; setStep(1); }
  function continueToFinance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateStep(1)) return;
    setFinance((current) => current.claimAmount !== "0" || current.expectedCollectionAmount !== "0"
      ? current
      : { ...current, claimAmount: form.caseValue || "0", expectedCollectionAmount: form.caseValue || "0" });
    setError(""); setStep(2);
  }
  function continueToProcess(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!validateStep(2)) return; setStep(3); }
  function continueToDocuments(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!validateStep(3)) return; setStep(4); }
  function continueToTasks(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setStep(5); }
  function continueToNotes(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setStep(6); }
  function validateStep(index: number) {
    const problems = index === 0 ? generalMissingFields(form)
      : index === 1 ? partyValidationErrors(parties)
        : index === 2 ? financeValidationErrors(finance, financialEntries)
          : index === 3 ? processValidationErrors(processEntries, hearings)
            : index === 5 ? taskValidationErrors(tasks) : [];
    if (!problems.length) { setMissingFields([]); setError(""); return true; }
    setMissingFields(index === 0 ? problems : []);
    setError(`Bu adımı tamamlayın: ${problems.slice(0, 4).join(", ")}.`);
    return false;
  }
  function goToStep(target: number) {
    if (createdCase || target === step) return;
    setError(""); setMissingFields([]);
    if (target < step) { setStep(target); return; }
    for (const index of [0, 1, 2, 3, 5]) {
      if (index >= target) break;
      if (!validateStep(index)) { setStep(index); return; }
    }
    if (target >= 2) setFinance((current) => current.claimAmount !== "0" || current.expectedCollectionAmount !== "0" ? current : { ...current, claimAmount: form.caseValue || "0", expectedCollectionAmount: form.caseValue || "0" });
    setStep(target);
  }
  function updateParty(clientId: string, name: keyof PartyDraft, value: string) { setParties((current) => current.map((party) => party.clientId === clientId ? { ...party, [name]: value } : party)); }
  function openPartyModal(party?: PartyDraft) {
    setEditingPartyId(party?.clientId ?? null);
    setPartyDraft(party ? { ...party } : makeParty("THIRD_PARTY"));
    setPartyModalErrors([]);
    setPartyModalOpen(true);
  }
  function savePartyDraft() {
    const problems = [!partyDraft.name.trim() && "Ad / Ünvan", !validIdentityNumber(partyDraft.identityOrTaxNumber, partyDraft.kind) && (partyDraft.kind === "INDIVIDUAL" ? "T.C. Kimlik No" : "Vergi No")].filter((item): item is string => Boolean(item));
    if (problems.length) {
      setPartyModalErrors(problems);
      requestAnimationFrame(() => {
        const target = problems.includes("Ad / Ünvan") ? partyNameRef.current : partyIdentityRef.current;
        target?.focus();
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setParties((current) => editingPartyId
      ? current.map((party) => party.clientId === editingPartyId ? partyDraft : party)
      : [...current, partyDraft]);
    setError(""); setPartyModalOpen(false); setEditingPartyId(null);
  }
  function removeParty(clientId: string) { setParties((current) => current.filter((party) => party.clientId !== clientId)); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    for (const index of [0, 1, 2, 3, 5]) {
      if (!validateStep(index)) { setStep(index); return; }
    }
    setSaving(true); setError("");
    try {
      let record = createdCase;
      if (!record) {
        const response = await fetch(editingCase ? `/api/general-legal-cases/${editingCase.id}` : "/api/general-legal-cases", {
        method: editingCase ? "PATCH" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          uyapMainNumber: form.uyapMainNumber || null, uyapDecisionNumber: form.uyapDecisionNumber || null,
          courthouse: form.kind === "GENERAL_LITIGATION" ? form.courthouse : null,
          courtType: form.kind === "GENERAL_LITIGATION" ? form.courtType : null,
          court: form.kind === "GENERAL_LITIGATION" ? form.court : null,
          procedure: form.procedure || null, estimatedCompletionDate: form.estimatedCompletionDate || null,
          trackingGroup: form.trackingGroup || null, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          office: form.office || null, description: form.description || null, responsibleUserId: currentUser.id,
          documentFolders,
          fileStaffUserId: null,
          parties: parties.map(partyPayload),
          finance: {
            ...finance,
            interestStartDate: finance.interestRequested ? finance.interestStartDate : null,
            installmentCount: finance.paymentPlan === "INSTALLMENT" ? Number(finance.installmentCount) : null,
            financeDescription: finance.financeDescription || null,
          },
          financialEntries: financialEntries.map(financialEntryPayload),
          processEntries: processEntries.map(processEntryPayload),
          hearings: hearings.map(hearingPayload),
          tasks: tasks.map(taskPayload),
          notes: notes.map(notePayload),
          ...(editingCase ? { version: editingCase.version } : {}),
        }),
      });
        const body = await response.json();
        if (!response.ok || !body.data) {
          const fields = body.error?.fields as Record<string, string[] | undefined> | undefined;
          const messages = fields ? Object.values(fields).flatMap((value) => value ?? []) : [];
          const names = fields ? Object.keys(fields).filter((name) => fields[name]?.length) : [];
          if (names.some((name) => ["kind", "caseType", "subject", "openingDate", "court", "status", "stage", "estimatedCompletionDate"].includes(name))) setStep(0);
          else if (names.includes("parties")) setStep(1);
          else if (names.some((name) => ["finance", "financialEntries"].includes(name))) setStep(2);
          else if (names.some((name) => ["processEntries", "hearings"].includes(name))) setStep(3);
          else if (names.includes("tasks")) setStep(5);
          throw new Error(messages.length ? messages.slice(0, 3).join(" ") : body.error?.message ?? "Dosya kaydedilemedi.");
        }
        record = body.data;
        setCreatedCase(record);
      }
      if (!record) throw new Error("Dosya kaydı doğrulanamadı.");
      for (const document of documents) {
        if (!document.file) continue;
        const data = new FormData(); data.append("file", document.file); data.append("category", document.category); data.append("folderKey", document.folder);
        const upload = await fetch(`/api/general-legal-cases/${record!.id}/documents`, { method: "POST", credentials: "same-origin", body: data });
        const uploadBody = await upload.json();
        if (!upload.ok) throw new Error(`Dosya oluşturuldu ancak ${document.originalName} yüklenemedi: ${uploadBody.error?.message ?? "Bilinmeyen hata"}. Tekrar deneyebilirsiniz.`);
        setDocuments((current) => current.filter((item) => item.clientId !== document.clientId));
      }
      router.push(`/genel-dava-ve-arabuluculuk?${editingCase ? "updated" : "created"}=${encodeURIComponent(record.referenceNumber)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dosya kaydedilemedi."); setSaving(false);
    }
  }
  const litigation = form.kind === "GENERAL_LITIGATION";

  return <AppShell pageTitle={readOnly ? `${editingCase?.referenceNumber ?? "Dosya"} Genel Bakışı` : editingCase ? `${editingCase.referenceNumber} Dosyasını Düzenle` : "Yeni Dosya Ekle"} pageSubtitle="Genel Dava ve Arabuluculuk"><main className={styles.page}>
    <header className={styles.header}><p>{readOnly ? "Dosya bilgileri salt okunur olarak görüntüleniyor." : editingCase ? "Dosyanın mevcut bilgilerini aynı adımlı yapı üzerinden güncelleyin." : "Genel dava veya arabuluculuk dosyasının tüm bilgilerini eksiksiz girin."}</p><Link href="/genel-dava-ve-arabuluculuk" className={styles.cancel}>← Listeye Dön</Link></header>
    <nav className={styles.steps} aria-label="Dosya oluşturma adımları">{steps.map((label, index) => <button type="button" key={label} className={index === step ? styles.activeStep : index < step ? styles.doneStep : ""} disabled={Boolean(createdCase)} onClick={() => goToStep(index)}><b>{index + 1}</b><span>{label}</span></button>)}</nav>
    {readOnly && <div className={styles.readOnlyNotice}><b>Salt okunur görünüm</b><span>Bu ekrandaki bilgiler değiştirilemez. Düzenlemek için listedeki kalem simgesini kullanın.</span></div>}
    <fieldset className={styles.workspaceFieldset} disabled={readOnly} aria-label={readOnly ? "Salt okunur dosya bilgileri" : undefined}>
    {step === 0 ? <form className={`${styles.form} ${styles.generalForm}`} onSubmit={continueToParties}>
      {error && <p className={partyStyles.error}>{error}</p>}
      <section className={styles.panel}><h2>▣ Dosya Bilgileri</h2><div className={styles.grid3}>
        <label><span>CRM Dosya No</span><input value={editingCase?.referenceNumber ?? "Kaydedildiğinde otomatik oluşur"} readOnly /></label>
        <label><span>Dosya Alanı *</span><select value={form.kind} onChange={(event) => updateKind(event.target.value)}><option value="GENERAL_LITIGATION">Genel Dava</option><option value="MEDIATION">Arabuluculuk</option></select></label>
        <label className={missingFields.includes("Dosya Türü") ? styles.invalid : ""}><span>Dosya Türü *</span><input aria-invalid={missingFields.includes("Dosya Türü")} maxLength={100} value={form.caseType} onChange={(event) => update("caseType", event.target.value)} placeholder={litigation ? "Örn. Tazminat" : "Örn. Ticari uyuşmazlık"} />{missingFields.includes("Dosya Türü") && <small style={{ color: "#b72f3b" }}>Dosya türünü yazın.</small>}</label>
        <label className={`${styles.span2} ${missingFields.includes("Dosya Konusu") ? styles.invalid : ""}`}><span>Dosya Konusu *</span><textarea aria-invalid={missingFields.includes("Dosya Konusu")} maxLength={4000} value={form.subject} onChange={(event) => update("subject", event.target.value)} placeholder="Uyuşmazlığın veya davanın kısa konusu" />{missingFields.includes("Dosya Konusu") && <small style={{ color: "#b72f3b" }}>Dosya konusunu açıklayın.</small>}</label>
        <label className={missingFields.includes("Açılış Tarihi") ? styles.invalid : ""}><span>Açılış Tarihi *</span><input aria-invalid={missingFields.includes("Açılış Tarihi")} type="date" max="9999-12-31" value={form.openingDate} onChange={(event) => update("openingDate", limitDateYear(event.target.value, form.openingDate))} />{missingFields.includes("Açılış Tarihi") && <small style={{ color: "#b72f3b" }}>Açılış tarihini seçin.</small>}</label>
        <label><span>Dosya Değeri</span><div className={styles.money}><input inputMode="decimal" value={form.caseValue} onChange={(event) => update("caseValue", formatMoneyInput(event.target.value))} /><b>TL</b></div></label>
        <label><span>{litigation ? "UYAP Esas No" : "Arabuluculuk Dosya No"}</span><input inputMode="numeric" maxLength={17} value={form.uyapMainNumber} onChange={(event) => update("uyapMainNumber", formatFileNumber(event.target.value))} placeholder="Örn. 2026/184" /></label>
        <label><span>{litigation ? "UYAP Karar No" : "Son Tutanak No"}</span><input inputMode="numeric" maxLength={17} value={form.uyapDecisionNumber} onChange={(event) => update("uyapDecisionNumber", formatFileNumber(event.target.value))} placeholder="Örn. 2026/458" /></label>
        {litigation && <><label className={missingFields.includes("Adliye") ? styles.invalid : ""}><span>Adliye *</span><input aria-invalid={missingFields.includes("Adliye")} required maxLength={150} value={form.courthouse} onChange={(event) => update("courthouse", event.target.value)} placeholder="Örn. İstanbul Adliyesi" /></label><label className={missingFields.includes("Mahkeme Türü") ? styles.invalid : ""}><span>Mahkeme Türü *</span><input aria-invalid={missingFields.includes("Mahkeme Türü")} required maxLength={100} value={form.courtType} onChange={(event) => update("courtType", event.target.value)} placeholder="Örn. Asliye Hukuk" /></label><label className={missingFields.includes("Mahkeme") ? styles.invalid : ""}><span>Mahkeme *</span><input aria-invalid={missingFields.includes("Mahkeme")} required maxLength={150} value={form.court} onChange={(event) => update("court", event.target.value)} placeholder="Örn. İstanbul 8. Asliye Hukuk" /></label></>}
        <label><span>Sorumlu Avukat *</span><input value={currentUser.name} readOnly /></label>
        <label><span>Dosya Personeli</span><input value="Henüz atanmadı" readOnly /></label>
        <label><span>Takip Eden Ofis</span><input maxLength={100} value={form.office} onChange={(event) => update("office", event.target.value)} placeholder="Örn. İstanbul Ofis" /></label>
        <label><span>Dosya Durumu *</span><select value={form.status} onChange={(event) => updateStatus(event.target.value)}><option value="DRAFT">Taslak</option><option value="ACTIVE">Derdest</option><option value="DECISION">Karar</option><option value="APPEAL">Kanun Yolu</option><option value="COMPLETED">Sonuçlandı</option><option value="CLOSED">Kapalı</option></select></label>
        <label><span>Dosya Aşaması *</span><select value={form.stage} onChange={(event) => updateStage(event.target.value)}>{stages.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Dava Şekli / Usul</span><input maxLength={100} value={form.procedure} onChange={(event) => update("procedure", event.target.value)} placeholder="Örn. Yazılı yargılama" /></label>
        <label><span>Takip Grubu</span><input maxLength={100} value={form.trackingGroup} onChange={(event) => update("trackingGroup", event.target.value)} /></label>
        <label><span>Gizlilik Durumu</span><select value={form.confidentiality} onChange={(event) => update("confidentiality", event.target.value)}><option value="NORMAL">Normal</option><option value="RESTRICTED">Kısıtlı</option></select></label>
        <label><span>Tahmini Sonuç Tarihi</span><input type="date" max="9999-12-31" value={form.estimatedCompletionDate} onChange={(event) => update("estimatedCompletionDate", limitDateYear(event.target.value, form.estimatedCompletionDate))} /></label>
        <label><span>Etiketler</span><input value={form.tags} onChange={(event) => update("tags", event.target.value)} placeholder="Virgülle ayırın: tazminat, ticari" /></label>
        <label className={styles.check}><input type="checkbox" checked={form.urgent} onChange={(event) => update("urgent", event.target.checked)} /><span>Acil Dosya</span></label>
      </div></section>
      <footer><span>1 / 7 · Genel Bilgiler</span><button type="submit">Sonraki: Taraflar →</button></footer>
    </form> : step === 1 ? <form className={`${styles.form} ${partyStyles.form}`} onSubmit={continueToFinance}>
      <header className={partyStyles.heading}><div><h2>Dosya Tarafları</h2><p>Asıl tarafları tanımlayın; müdahil, üçüncü kişi ve ilgili kurumları ayrıca ekleyin.</p></div></header>
      {error && <p className={partyStyles.error}>{error}</p>}
      <div className={partyStyles.cards}>{parties.slice(0, 2).map((party, index) =>
        <article className={`${partyStyles.card} ${index === 0 ? partyStyles.claimant : partyStyles.respondent}`} key={party.clientId}><header><strong>{partyRoleLabel(party.role)}</strong><span>{party.kind === "INDIVIDUAL" ? "Gerçek kişi" : "Tüzel kişi / kurum"}</span></header><div className={partyStyles.kindTabs}><button type="button" className={party.kind === "INDIVIDUAL" ? partyStyles.selected : ""} onClick={() => updateParty(party.clientId, "kind", "INDIVIDUAL")}>Gerçek Kişi</button><button type="button" className={party.kind === "ORGANIZATION" ? partyStyles.selected : ""} onClick={() => updateParty(party.clientId, "kind", "ORGANIZATION")}>Tüzel Kişi (Şirket)</button></div><div className={partyStyles.grid}>
          <label><span>Kişi Türü *</span><select value={party.kind} onChange={(event) => updateParty(party.clientId, "kind", event.target.value)}><option value="INDIVIDUAL">Gerçek Kişi</option><option value="ORGANIZATION">Tüzel Kişi / Kurum</option></select></label>
          <label className={partyStyles.wide}><span>{party.kind === "INDIVIDUAL" ? "Ad Soyad" : "Ünvan"} *</span><input required maxLength={200} value={party.name} onChange={(event) => updateParty(party.clientId, "name", event.target.value)} /></label>
          <label><span>{party.kind === "INDIVIDUAL" ? "T.C. Kimlik No *" : "Vergi No *"}</span><input required inputMode="numeric" minLength={party.kind === "INDIVIDUAL" ? 11 : 10} maxLength={party.kind === "INDIVIDUAL" ? 11 : 10} value={party.identityOrTaxNumber} onChange={(event) => updateParty(party.clientId, "identityOrTaxNumber", event.target.value.replace(/\D/g, "").slice(0, party.kind === "INDIVIDUAL" ? 11 : 10))} /></label>
          <label><span>Telefon</span><input inputMode="numeric" maxLength={11} value={party.phone} onChange={(event) => updateParty(party.clientId, "phone", event.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="05XXXXXXXXX" /></label>
          <label><span>E-posta</span><input type="email" maxLength={254} value={party.email} onChange={(event) => updateParty(party.clientId, "email", event.target.value)} /></label>
          <label><span>Vekil / Temsilci</span><input maxLength={200} value={party.representativeName} onChange={(event) => updateParty(party.clientId, "representativeName", event.target.value)} /></label>
          <label><span>Müvekkil Türü</span><input maxLength={100} value={party.clientType} onChange={(event) => updateParty(party.clientId, "clientType", event.target.value)} placeholder="Örn. Asıl taraf" /></label>
          <label className={partyStyles.wide}><span>Adres</span><input maxLength={2000} value={party.address} onChange={(event) => updateParty(party.clientId, "address", event.target.value)} /></label>
          <label className={partyStyles.wide}><span>Açıklama</span><input maxLength={500} value={party.description} onChange={(event) => updateParty(party.clientId, "description", event.target.value)} /></label>
        </div></article>)}</div>
      <section className={partyStyles.otherParties}><header><div><h3>Diğer Taraflar</h3><p>Müdahil, üçüncü kişi, ilgili kurum ve diğer bağlantılı taraflar.</p></div><button type="button" onClick={() => openPartyModal()}>+ Diğer Taraf Ekle</button></header>
        {parties.length === 2 ? <p className={partyStyles.empty}>Henüz başka taraf eklenmedi.</p> : <div className={partyStyles.tableWrap}><table><thead><tr><th>Taraf Türü</th><th>Ad / Ünvan</th><th>T.C. / Vergi No</th><th>Vekil</th><th>Açıklama</th><th>İşlemler</th></tr></thead><tbody>{parties.slice(2).map((party) => <tr key={party.clientId}><td>{partyRoleLabel(party.role)}</td><td><strong>{party.name}</strong><small>{party.kind === "INDIVIDUAL" ? "Gerçek kişi" : "Tüzel kişi"}</small></td><td>{party.identityOrTaxNumber || "—"}</td><td>{party.representativeName || "—"}</td><td>{party.description || "—"}</td><td><span style={{ display: "inline-flex", gap: 8 }}><button type="button" title="Tarafı düzenle" aria-label={`${party.name} tarafını düzenle`} onClick={() => openPartyModal(party)}>✎</button><button type="button" title="Tarafı sil" aria-label={`${party.name} tarafını sil`} className={partyStyles.delete} onClick={() => removeParty(party.clientId)}>⌫</button></span></td></tr>)}</tbody></table></div>}
      </section>
      <footer><button type="button" className={partyStyles.back} onClick={() => setStep(0)}>← Genel Bilgiler</button><span>2 / 7 · Taraflar</span><button type="submit">Mali Bilgilere İlerle →</button></footer>
      {partyModalOpen && <div className={partyStyles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPartyModalOpen(false); }}><section className={partyStyles.modal} role="dialog" aria-modal="true" aria-labelledby="party-modal-title"><header><div><h2 id="party-modal-title">{editingPartyId ? "Diğer Tarafı Düzenle" : "Diğer Taraf Ekle"}</h2><p>Kişi veya kurumun dosyadaki rolünü ve iletişim bilgilerini girin.</p></div><button type="button" aria-label="Kapat" onClick={() => setPartyModalOpen(false)}>×</button></header>{partyModalErrors.length > 0 && <div className={partyStyles.modalNotice} role="alert"><strong>Bu bilgiler kaydedilemedi.</strong><span>{partyModalErrors.map((field) => field === "Ad / Ünvan" ? "Ad veya ünvanı girin." : partyDraft.kind === "INDIVIDUAL" ? "T.C. Kimlik No 11 haneli olmalıdır." : "Vergi No 10 haneli olmalıdır.").join(" ")}</span></div>}<div className={partyStyles.modalGrid}>
        <label><span>Taraf Rolü *</span><select value={partyDraft.role} onChange={(event) => setPartyDraft((current) => ({ ...current, role: event.target.value }))}>{availableRoles(form.kind).filter(([role]) => !["PLAINTIFF", "DEFENDANT", "APPLICANT", "RESPONDENT"].includes(role)).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Kişi Türü *</span><select value={partyDraft.kind} onChange={(event) => setPartyDraft((current) => ({ ...current, kind: event.target.value as PartyDraft["kind"] }))}><option value="INDIVIDUAL">Gerçek Kişi</option><option value="ORGANIZATION">Tüzel Kişi / Kurum</option></select></label>
        <label className={`${partyStyles.modalWide} ${partyModalErrors.includes("Ad / Ünvan") ? partyStyles.invalid : ""}`}><span>{partyDraft.kind === "INDIVIDUAL" ? "Ad Soyad" : "Şirket / Kurum Ünvanı"} *</span><input ref={partyNameRef} autoFocus aria-invalid={partyModalErrors.includes("Ad / Ünvan")} maxLength={200} value={partyDraft.name} onChange={(event) => { setPartyDraft((current) => ({ ...current, name: event.target.value })); setPartyModalErrors((current) => current.filter((item) => item !== "Ad / Ünvan")); }} />{partyModalErrors.includes("Ad / Ünvan") && <small>Ad veya ünvan zorunludur.</small>}</label>
        <label className={partyModalErrors.some((item) => item.includes("No")) ? partyStyles.invalid : ""}><span>{partyDraft.kind === "INDIVIDUAL" ? "T.C. Kimlik No *" : "Vergi No *"}</span><input ref={partyIdentityRef} aria-invalid={partyModalErrors.some((item) => item.includes("No"))} inputMode="numeric" maxLength={partyDraft.kind === "INDIVIDUAL" ? 11 : 10} value={partyDraft.identityOrTaxNumber} onChange={(event) => { setPartyDraft((current) => ({ ...current, identityOrTaxNumber: event.target.value.replace(/\D/g, "").slice(0, current.kind === "INDIVIDUAL" ? 11 : 10) })); setPartyModalErrors((current) => current.filter((item) => !item.includes("No"))); }} />{partyModalErrors.some((item) => item.includes("No")) && <small>{partyDraft.kind === "INDIVIDUAL" ? "11 haneli T.C. kimlik numarası girin." : "10 haneli vergi numarası girin."}</small>}</label>
        <label><span>Telefon</span><input inputMode="numeric" maxLength={11} value={partyDraft.phone} onChange={(event) => setPartyDraft((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "").slice(0, 11) }))} placeholder="05XXXXXXXXX" /></label>
        <label><span>E-posta</span><input type="email" maxLength={254} value={partyDraft.email} onChange={(event) => setPartyDraft((current) => ({ ...current, email: event.target.value }))} /></label>
        <label><span>Vekil / Temsilci</span><input maxLength={200} value={partyDraft.representativeName} onChange={(event) => setPartyDraft((current) => ({ ...current, representativeName: event.target.value }))} /></label>
        <label><span>Taraf Niteliği</span><input maxLength={100} value={partyDraft.clientType} onChange={(event) => setPartyDraft((current) => ({ ...current, clientType: event.target.value }))} placeholder="Örn. Fer'i müdahil" /></label>
        <label className={partyStyles.modalWide}><span>Adres</span><textarea maxLength={2000} value={partyDraft.address} onChange={(event) => setPartyDraft((current) => ({ ...current, address: event.target.value }))} /></label>
        <label className={partyStyles.modalWide}><span>Açıklama</span><textarea maxLength={500} value={partyDraft.description} onChange={(event) => setPartyDraft((current) => ({ ...current, description: event.target.value }))} /></label>
      </div><footer><button type="button" className={partyStyles.back} onClick={() => setPartyModalOpen(false)}>Vazgeç</button><button type="button" onClick={savePartyDraft}>{editingPartyId ? "Değişiklikleri Kaydet" : "Tarafı Ekle"}</button></footer></section></div>}
    </form> : step === 2 ? <FinanceStep caseValue={form.caseValue} finance={finance} setFinance={setFinance} entries={financialEntries} setEntries={setFinancialEntries} onBack={() => setStep(1)} onSubmit={continueToProcess} saving={false} error={error} />
      : step === 3 ? <ProcessStep currentUser={currentUser} currentStage={form.stage} onStageChange={updateStage} entries={processEntries} setEntries={setProcessEntries} hearings={hearings} setHearings={setHearings} onBack={() => setStep(2)} onSubmit={continueToDocuments} error={error} />
        : step === 4 ? <DocumentsStep documents={documents} setDocuments={setDocuments} caseId={editingCase?.id} folderConfig={documentFolders} setFolderConfig={setDocumentFolders} onBack={() => setStep(3)} onSubmit={continueToTasks} error={error} />
          : step === 5 ? <TaskStep currentUser={currentUser} tasks={tasks} setTasks={setTasks} onBack={() => setStep(4)} onSubmit={continueToNotes} error={error} />
            : <NoteStep currentUser={currentUser} notes={notes} setNotes={setNotes} onBack={() => setStep(5)} onSubmit={submit} saving={saving} error={error} />}
    </fieldset>
  </main></AppShell>;
}

function currentIstanbulDate() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function generalMissingFields(form: GeneralCaseDraft) {
  return [
    !form.caseType.trim() && "Dosya Türü", !form.subject.trim() && "Dosya Konusu", !form.openingDate && "Açılış Tarihi",
    form.openingDate > currentIstanbulDate() && "Açılış tarihi gelecekte olamaz",
    form.estimatedCompletionDate && form.estimatedCompletionDate < form.openingDate && "Tahmini sonuç tarihi açılış tarihinden önce olamaz",
    form.kind === "GENERAL_LITIGATION" && !form.courthouse.trim() && "Adliye",
    form.kind === "GENERAL_LITIGATION" && !form.courtType.trim() && "Mahkeme Türü",
    form.kind === "GENERAL_LITIGATION" && !form.court.trim() && "Mahkeme",
  ].filter((item): item is string => Boolean(item));
}

function partyValidationErrors(parties: PartyDraft[]) {
  return parties.flatMap((party, index) => {
    const label = index < 2 ? partyRoleLabel(party.role) : party.name || "Diğer taraf";
    return [
      !party.name.trim() && `${label}: ad / ünvan`,
      !validIdentityNumber(party.identityOrTaxNumber, party.kind) && `${label}: ${party.kind === "INDIVIDUAL" ? "11 haneli T.C. Kimlik No" : "10 haneli Vergi No"}`,
      party.phone && !/^\d{10,11}$/.test(party.phone) && `${label}: telefon 10 veya 11 rakam olmalı`,
      party.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(party.email) && `${label}: geçerli e-posta`,
    ].filter((item): item is string => Boolean(item));
  });
}

function financeValidationErrors(finance: FinanceDraft, entries: FinancialEntryDraft[]) {
  return [
    parseMoneyToCents(finance.claimAmount) === null && "Talep tutarı geçersiz",
    parseMoneyToCents(finance.amendmentAmount) === null && "Islah tutarı geçersiz",
    parseMoneyToCents(finance.expectedCollectionAmount) === null && "Tahsil edilecek tutar geçersiz",
    parseMoneyToCents(finance.opposingAttorneyFee) === null && "Karşı vekâlet ücreti geçersiz",
    finance.interestRequested && !finance.interestStartDate && "Faiz başlangıç tarihi",
    finance.paymentPlan === "INSTALLMENT" && !(Number(finance.installmentCount) >= 2 && Number(finance.installmentCount) <= 120) && "Taksit sayısı 2-120 arasında olmalı",
    entries.some((item) => !item.category.trim() || !item.description.trim() || !item.entryDate || (parseMoneyToCents(item.amount) ?? 0n) <= 0n) && "Mali hareket bilgileri",
  ].filter((item): item is string => Boolean(item));
}

function processValidationErrors(entries: ProcessEntryDraft[], hearings: HearingDraft[]) {
  return [
    entries.some((item) => !item.action.trim() || !item.eventDate) && "Süreç işlemi bilgileri",
    hearings.some((item) => !item.startsAt || !item.court.trim() || !item.hearingType.trim()) && "Duruşma bilgileri",
    hearings.some((item) => item.status === "PLANNED" && new Date(item.startsAt).getTime() <= Date.now()) && "Planlanan duruşma gelecekte olmalı",
  ].filter((item): item is string => Boolean(item));
}

function taskValidationErrors(tasks: TaskDraft[]) {
  return [tasks.some((task) => !task.title.trim() || !task.dueAt) && "Görev başlığı ve son tarih"].filter((item): item is string => Boolean(item));
}

function generalFieldLabel(name: keyof GeneralCaseDraft) {
  return ({ caseType: "Dosya Türü", subject: "Dosya Konusu", openingDate: "Açılış Tarihi", courthouse: "Adliye", courtType: "Mahkeme Türü", court: "Mahkeme" } as Partial<Record<keyof GeneralCaseDraft, string>>)[name];
}

function formatFileNumber(value: string) {
  const clean = value.replace(/[^\d/]/g, ""); const [year = "", ...rest] = clean.split("/");
  return rest.length ? `${year.slice(0, 4)}/${rest.join("").slice(0, 12)}` : year.slice(0, 16);
}

function validIdentityNumber(value: string, kind: PartyDraft["kind"]) { return /^\d+$/.test(value) && value.length === (kind === "INDIVIDUAL" ? 11 : 10); }

function makeParty(role: string, clientId = crypto.randomUUID()): PartyDraft {
  return { clientId, role, kind: "INDIVIDUAL", name: "", identityOrTaxNumber: "", phone: "", email: "", address: "", representativeName: "", clientType: "", description: "" };
}

function primaryParties(kind: string) {
  return kind === "MEDIATION"
    ? [makeParty("APPLICANT", "primary-applicant"), makeParty("RESPONDENT", "primary-respondent")]
    : [makeParty("PLAINTIFF", "primary-plaintiff"), makeParty("DEFENDANT", "primary-defendant")];
}

function availableRoles(kind: string): Array<[string, string]> {
  return kind === "MEDIATION"
    ? [["APPLICANT", "Başvuran"], ["RESPONDENT", "Karşı Taraf"], ["THIRD_PARTY", "Üçüncü Kişi"], ["RELATED_INSTITUTION", "İlgili Kurum"]]
    : [["PLAINTIFF", "Davacı"], ["DEFENDANT", "Davalı"], ["INTERVENOR", "Müdahil"], ["THIRD_PARTY", "Üçüncü Kişi"], ["RELATED_INSTITUTION", "İlgili Kurum"]];
}

function partyRoleLabel(role: string) {
  return availableRoles(role === "APPLICANT" || role === "RESPONDENT" ? "MEDIATION" : "GENERAL_LITIGATION").find(([value]) => value === role)?.[1] ?? "Diğer Taraf";
}

function partyPayload(party: PartyDraft) {
  return {
    role: party.role, kind: party.kind, name: party.name,
    identityOrTaxNumber: party.identityOrTaxNumber || null, phone: party.phone || null,
    email: party.email || null, address: party.address || null, representativeUserId: null,
    representativeName: party.representativeName || null, clientType: party.clientType || null,
    description: party.description || null,
  };
}

function financialEntryPayload(entry: FinancialEntryDraft) {
  return { type: entry.type, category: entry.category, entryDate: entry.entryDate, amount: entry.amount, description: entry.description };
}

function processEntryPayload(entry: ProcessEntryDraft) {
  return { type: entry.type, stage: entry.stage, eventDate: entry.eventDate, action: entry.action, description: entry.description || null, responsibleUserId: entry.responsibleUserId };
}

function hearingPayload(hearing: HearingDraft) {
  return { startsAt: new Date(hearing.startsAt).toISOString(), court: hearing.court, hearingType: hearing.hearingType, courtroom: hearing.courtroom || null, attendeeUserId: hearing.attendeeUserId, reminderOffsetMinutes: hearing.reminderOffsetMinutes, note: hearing.note || null, status: hearing.status };
}

function taskPayload(task: TaskDraft) {
  return { title: task.title, description: task.description || null, assigneeUserId: task.assigneeUserId, priority: task.priority, dueAt: new Date(task.dueAt).toISOString(), taskType: task.taskType || null, reminderOffsetMinutes: task.reminderOffsetMinutes, status: task.status };
}

function notePayload(note: NoteDraft) {
  return { content: note.content, noteType: note.noteType, visibility: note.visibility, important: note.important };
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
