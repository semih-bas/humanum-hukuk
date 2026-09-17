"use client";

import AppShell from "@/components/app-shell/AppShell";
import { formatMoneyInput, limitDateYear } from "@/lib/form-input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import FinanceStep, { type FinanceDraft, type FinancialEntryDraft } from "./FinanceStep";
import DocumentsStep, { type DocumentDraft } from "./DocumentsStep";
import partyStyles from "./PartyStep.module.css";
import ProcessStep, { type HearingDraft, type ProcessEntryDraft } from "./ProcessStep";
import TaskStep, { type TaskDraft } from "./TaskStep";
import NoteStep, { type NoteDraft } from "./NoteStep";
import styles from "./page.module.css";

const steps = ["Genel Bilgiler", "Taraflar", "Mali Bilgiler", "Dava Süreci", "Evraklar", "Görevler", "Notlar"];
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

export default function GeneralCaseWizard({ currentUser }: { currentUser: { id: string; name: string } }) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(0);
  const [parties, setParties] = useState<PartyDraft[]>(() => primaryParties("GENERAL_LITIGATION"));
  const [finance, setFinance] = useState<FinanceDraft>(initialFinance);
  const [financialEntries, setFinancialEntries] = useState<FinancialEntryDraft[]>([]);
  const [processEntries, setProcessEntries] = useState<ProcessEntryDraft[]>([]);
  const [hearings, setHearings] = useState<HearingDraft[]>([]);
  const [documents, setDocuments] = useState<DocumentDraft[]>([]);
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [notes, setNotes] = useState<NoteDraft[]>([]);
  const [createdCase, setCreatedCase] = useState<{ id: string; referenceNumber: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [partyDraft, setPartyDraft] = useState<PartyDraft>(() => makeParty("THIRD_PARTY"));
  function update(name: keyof GeneralCaseDraft, value: string | boolean) { setForm((current) => ({ ...current, [name]: value })); }
  function updateKind(value: string) { setForm((current) => ({ ...current, kind: value })); setParties(primaryParties(value)); }
  function updateStatus(value: string) { setForm((current) => ({ ...current, status: value, stage: value === "CLOSED" ? "CLOSED" : current.stage === "CLOSED" ? "CASE_OPENING" : current.stage })); }
  function updateStage(value: string) { setForm((current) => ({ ...current, stage: value, status: value === "CLOSED" ? "CLOSED" : current.status === "CLOSED" ? "ACTIVE" : current.status })); }
  function continueToParties(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setStep(1); }
  function continueToFinance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFinance((current) => current.claimAmount !== "0" || current.expectedCollectionAmount !== "0"
      ? current
      : { ...current, claimAmount: form.caseValue || "0", expectedCollectionAmount: form.caseValue || "0" });
    setError(""); setStep(2);
  }
  function continueToProcess(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setStep(3); }
  function continueToDocuments(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setStep(4); }
  function continueToTasks(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setStep(5); }
  function continueToNotes(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setStep(6); }
  function goToStep(target: number) {
    if (createdCase || target === step) return;
    setError(""); setMissingFields([]);
    if (target < step) { setStep(target); return; }
    const generalMissing = [
      !form.caseType.trim() && "Dosya Türü", !form.subject.trim() && "Dosya Konusu", !form.openingDate && "Açılış Tarihi",
      form.kind === "GENERAL_LITIGATION" && !form.courthouse.trim() && "Adliye",
      form.kind === "GENERAL_LITIGATION" && !form.courtType.trim() && "Mahkeme Türü",
      form.kind === "GENERAL_LITIGATION" && !form.court.trim() && "Mahkeme",
    ].filter((item): item is string => Boolean(item));
    if (generalMissing.length) {
      setStep(0); setMissingFields(generalMissing); setError(`Eksik zorunlu alanlar: ${generalMissing.join(", ")}.`); return;
    }
    const partyMissing = parties.slice(0, 2).filter((party) => !party.name.trim()).map((party) => partyRoleLabel(party.role));
    if (target > 1 && partyMissing.length) {
      setStep(1); setMissingFields(partyMissing); setError(`Eksik zorunlu taraflar: ${partyMissing.join(", ")}.`); return;
    }
    if (target >= 2) setFinance((current) => current.claimAmount !== "0" || current.expectedCollectionAmount !== "0" ? current : { ...current, claimAmount: form.caseValue || "0", expectedCollectionAmount: form.caseValue || "0" });
    setStep(target);
  }
  function updateParty(clientId: string, name: keyof PartyDraft, value: string) { setParties((current) => current.map((party) => party.clientId === clientId ? { ...party, [name]: value } : party)); }
  function openPartyModal(party?: PartyDraft) {
    setEditingPartyId(party?.clientId ?? null);
    setPartyDraft(party ? { ...party } : makeParty("THIRD_PARTY"));
    setPartyModalOpen(true);
  }
  function savePartyDraft() {
    if (!partyDraft.name.trim()) { setError("Diğer taraf için ad / ünvan alanını doldurun."); return; }
    setParties((current) => editingPartyId
      ? current.map((party) => party.clientId === editingPartyId ? partyDraft : party)
      : [...current, partyDraft]);
    setError(""); setPartyModalOpen(false); setEditingPartyId(null);
  }
  function removeParty(clientId: string) { setParties((current) => current.filter((party) => party.clientId !== clientId)); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return; setSaving(true); setError("");
    try {
      let record = createdCase;
      if (!record) {
        const response = await fetch("/api/general-legal-cases", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          uyapMainNumber: form.uyapMainNumber || null, uyapDecisionNumber: form.uyapDecisionNumber || null,
          courthouse: form.kind === "GENERAL_LITIGATION" ? form.courthouse : null,
          courtType: form.kind === "GENERAL_LITIGATION" ? form.courtType : null,
          court: form.kind === "GENERAL_LITIGATION" ? form.court : null,
          procedure: form.procedure || null, estimatedCompletionDate: form.estimatedCompletionDate || null,
          trackingGroup: form.trackingGroup || null, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          office: form.office || null, description: form.description || null, responsibleUserId: currentUser.id,
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
        }),
      });
        const body = await response.json();
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Dosya kaydedilemedi.");
        record = body.data;
        setCreatedCase(record);
      }
      if (!record) throw new Error("Dosya kaydı doğrulanamadı.");
      for (const document of documents) {
        const data = new FormData(); data.append("file", document.file); data.append("category", document.category);
        const upload = await fetch(`/api/general-legal-cases/${record!.id}/documents`, { method: "POST", credentials: "same-origin", body: data });
        const uploadBody = await upload.json();
        if (!upload.ok) throw new Error(`Dosya oluşturuldu ancak ${document.file.name} yüklenemedi: ${uploadBody.error?.message ?? "Bilinmeyen hata"}. Tekrar deneyebilirsiniz.`);
        setDocuments((current) => current.filter((item) => item.clientId !== document.clientId));
      }
      router.push(`/genel-dava-ve-arabuluculuk?created=${encodeURIComponent(record.referenceNumber)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dosya kaydedilemedi."); setSaving(false);
    }
  }
  const litigation = form.kind === "GENERAL_LITIGATION";

  return <AppShell><main className={styles.page}>
    <header className={styles.header}><div><div><h1>Yeni Dosya Ekle</h1><p>Genel dava veya arabuluculuk dosyasının tüm bilgilerini eksiksiz girin.</p></div></div><Link href="/genel-dava-ve-arabuluculuk" className={styles.cancel}>← Listeye Dön</Link></header>
    <nav className={styles.steps} aria-label="Dosya oluşturma adımları">{steps.map((label, index) => <button type="button" key={label} className={index === step ? styles.activeStep : index < step ? styles.doneStep : ""} disabled={Boolean(createdCase)} onClick={() => goToStep(index)}><b>{index + 1}</b><span>{label}</span></button>)}</nav>
    {step === 0 ? <form className={`${styles.form} ${styles.generalForm}`} onSubmit={continueToParties}>
      {error && <p className={styles.formError}>{error}{missingFields.length > 0 && <span> Lütfen kırmızı işaretli alanları tamamlayın.</span>}</p>}
      <section className={styles.panel}><h2>▣ Dosya Bilgileri</h2><div className={styles.grid3}>
        <label><span>CRM Dosya No</span><input value="Kaydedildiğinde otomatik oluşur" readOnly /></label>
        <label><span>Dosya Alanı *</span><select value={form.kind} onChange={(event) => updateKind(event.target.value)}><option value="GENERAL_LITIGATION">Genel Dava</option><option value="MEDIATION">Arabuluculuk</option></select></label>
        <label className={missingFields.includes("Dosya Türü") ? styles.invalid : ""}><span>Dosya Türü *</span><input aria-invalid={missingFields.includes("Dosya Türü")} required maxLength={100} value={form.caseType} onChange={(event) => update("caseType", event.target.value)} placeholder={litigation ? "Örn. Tazminat" : "Örn. Ticari uyuşmazlık"} /></label>
        <label className={`${styles.span2} ${missingFields.includes("Dosya Konusu") ? styles.invalid : ""}`}><span>Dosya Konusu *</span><textarea aria-invalid={missingFields.includes("Dosya Konusu")} required maxLength={4000} value={form.subject} onChange={(event) => update("subject", event.target.value)} placeholder="Uyuşmazlığın veya davanın kısa konusu" /></label>
        <label className={missingFields.includes("Açılış Tarihi") ? styles.invalid : ""}><span>Açılış Tarihi *</span><input aria-invalid={missingFields.includes("Açılış Tarihi")} required type="date" max="9999-12-31" value={form.openingDate} onChange={(event) => update("openingDate", limitDateYear(event.target.value, form.openingDate))} /></label>
        <label><span>Dosya Değeri</span><div className={styles.money}><input inputMode="decimal" value={form.caseValue} onChange={(event) => update("caseValue", formatMoneyInput(event.target.value))} /><b>TL</b></div></label>
        <label><span>{litigation ? "UYAP Esas No" : "Arabuluculuk Dosya No"}</span><input maxLength={80} value={form.uyapMainNumber} onChange={(event) => update("uyapMainNumber", event.target.value)} placeholder="Örn. 2026/184" /></label>
        <label><span>{litigation ? "UYAP Karar No" : "Son Tutanak No"}</span><input maxLength={80} value={form.uyapDecisionNumber} onChange={(event) => update("uyapDecisionNumber", event.target.value)} placeholder="Örn. 2026/458" /></label>
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
        <label className={styles.span2}><span>Açıklama</span><textarea maxLength={4000} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Dosya ile ilgili genel açıklamalar" /></label>
      </div></section>
      <footer><span>1 / 7 · Genel Bilgiler</span><button type="submit">Sonraki: Taraflar →</button></footer>
    </form> : step === 1 ? <form className={`${styles.form} ${partyStyles.form}`} onSubmit={continueToFinance}>
      <header className={partyStyles.heading}><div><h2>Dosya Tarafları</h2><p>Asıl tarafları tanımlayın; müdahil, üçüncü kişi ve ilgili kurumları ayrıca ekleyin.</p></div></header>
      {error && <p className={partyStyles.error}>{error}</p>}
      <div className={partyStyles.cards}>{parties.slice(0, 2).map((party, index) =>
        <article className={`${partyStyles.card} ${index === 0 ? partyStyles.claimant : partyStyles.respondent}`} key={party.clientId}><header><strong>{partyRoleLabel(party.role)}</strong><span>{party.kind === "INDIVIDUAL" ? "Gerçek kişi" : "Tüzel kişi / kurum"}</span></header><div className={partyStyles.kindTabs}><button type="button" className={party.kind === "INDIVIDUAL" ? partyStyles.selected : ""} onClick={() => updateParty(party.clientId, "kind", "INDIVIDUAL")}>Gerçek Kişi</button><button type="button" className={party.kind === "ORGANIZATION" ? partyStyles.selected : ""} onClick={() => updateParty(party.clientId, "kind", "ORGANIZATION")}>Tüzel Kişi (Şirket)</button></div><div className={partyStyles.grid}>
          <label><span>Kişi Türü *</span><select value={party.kind} onChange={(event) => updateParty(party.clientId, "kind", event.target.value)}><option value="INDIVIDUAL">Gerçek Kişi</option><option value="ORGANIZATION">Tüzel Kişi / Kurum</option></select></label>
          <label className={partyStyles.wide}><span>{party.kind === "INDIVIDUAL" ? "Ad Soyad" : "Ünvan"} *</span><input required maxLength={200} value={party.name} onChange={(event) => updateParty(party.clientId, "name", event.target.value)} /></label>
          <label><span>T.C. / Vergi No</span><input inputMode="numeric" maxLength={11} value={party.identityOrTaxNumber} onChange={(event) => updateParty(party.clientId, "identityOrTaxNumber", event.target.value.replace(/\D/g, "").slice(0, 11))} /></label>
          <label><span>Telefon</span><input maxLength={30} value={party.phone} onChange={(event) => updateParty(party.clientId, "phone", event.target.value)} /></label>
          <label><span>E-posta</span><input type="email" maxLength={254} value={party.email} onChange={(event) => updateParty(party.clientId, "email", event.target.value)} /></label>
          <label><span>Vekil / Temsilci</span><input maxLength={200} value={party.representativeName} onChange={(event) => updateParty(party.clientId, "representativeName", event.target.value)} /></label>
          <label><span>Müvekkil Türü</span><input maxLength={100} value={party.clientType} onChange={(event) => updateParty(party.clientId, "clientType", event.target.value)} placeholder="Örn. Asıl taraf" /></label>
          <label className={partyStyles.wide}><span>Adres</span><input maxLength={2000} value={party.address} onChange={(event) => updateParty(party.clientId, "address", event.target.value)} /></label>
          <label className={partyStyles.wide}><span>Açıklama</span><input maxLength={500} value={party.description} onChange={(event) => updateParty(party.clientId, "description", event.target.value)} /></label>
        </div></article>)}</div>
      <section className={partyStyles.otherParties}><header><div><h3>Diğer Taraflar</h3><p>Müdahil, üçüncü kişi, ilgili kurum ve diğer bağlantılı taraflar.</p></div><button type="button" onClick={() => openPartyModal()}>+ Diğer Taraf Ekle</button></header>
        {parties.length === 2 ? <p className={partyStyles.empty}>Henüz başka taraf eklenmedi.</p> : <div className={partyStyles.tableWrap}><table><thead><tr><th>Taraf Türü</th><th>Ad / Ünvan</th><th>T.C. / Vergi No</th><th>Vekil</th><th>Açıklama</th><th>İşlemler</th></tr></thead><tbody>{parties.slice(2).map((party) => <tr key={party.clientId}><td>{partyRoleLabel(party.role)}</td><td><strong>{party.name}</strong><small>{party.kind === "INDIVIDUAL" ? "Gerçek kişi" : "Tüzel kişi"}</small></td><td>{party.identityOrTaxNumber || "—"}</td><td>{party.representativeName || "—"}</td><td>{party.description || "—"}</td><td><button type="button" onClick={() => openPartyModal(party)}>Düzenle</button><button type="button" className={partyStyles.delete} onClick={() => removeParty(party.clientId)}>Sil</button></td></tr>)}</tbody></table></div>}
      </section>
      <footer><button type="button" className={partyStyles.back} onClick={() => setStep(0)}>← Genel Bilgiler</button><span>2 / 7 · Taraflar</span><button type="submit">Mali Bilgilere İlerle →</button></footer>
      {partyModalOpen && <div className={partyStyles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPartyModalOpen(false); }}><section className={partyStyles.modal} role="dialog" aria-modal="true" aria-labelledby="party-modal-title"><header><div><h2 id="party-modal-title">{editingPartyId ? "Diğer Tarafı Düzenle" : "Diğer Taraf Ekle"}</h2><p>Kişi veya kurumun dosyadaki rolünü ve iletişim bilgilerini girin.</p></div><button type="button" aria-label="Kapat" onClick={() => setPartyModalOpen(false)}>×</button></header><div className={partyStyles.modalGrid}>
        <label><span>Taraf Rolü *</span><select value={partyDraft.role} onChange={(event) => setPartyDraft((current) => ({ ...current, role: event.target.value }))}>{availableRoles(form.kind).filter(([role]) => !["PLAINTIFF", "DEFENDANT", "APPLICANT", "RESPONDENT"].includes(role)).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Kişi Türü *</span><select value={partyDraft.kind} onChange={(event) => setPartyDraft((current) => ({ ...current, kind: event.target.value as PartyDraft["kind"] }))}><option value="INDIVIDUAL">Gerçek Kişi</option><option value="ORGANIZATION">Tüzel Kişi / Kurum</option></select></label>
        <label className={partyStyles.modalWide}><span>{partyDraft.kind === "INDIVIDUAL" ? "Ad Soyad" : "Şirket / Kurum Ünvanı"} *</span><input autoFocus maxLength={200} value={partyDraft.name} onChange={(event) => setPartyDraft((current) => ({ ...current, name: event.target.value }))} /></label>
        <label><span>T.C. / Vergi No</span><input inputMode="numeric" maxLength={11} value={partyDraft.identityOrTaxNumber} onChange={(event) => setPartyDraft((current) => ({ ...current, identityOrTaxNumber: event.target.value.replace(/\D/g, "").slice(0, 11) }))} /></label>
        <label><span>Telefon</span><input inputMode="tel" maxLength={30} value={partyDraft.phone} onChange={(event) => setPartyDraft((current) => ({ ...current, phone: event.target.value.replace(/[^\d+()\s-]/g, "") }))} /></label>
        <label><span>E-posta</span><input type="email" maxLength={254} value={partyDraft.email} onChange={(event) => setPartyDraft((current) => ({ ...current, email: event.target.value }))} /></label>
        <label><span>Vekil / Temsilci</span><input maxLength={200} value={partyDraft.representativeName} onChange={(event) => setPartyDraft((current) => ({ ...current, representativeName: event.target.value }))} /></label>
        <label><span>Taraf Niteliği</span><input maxLength={100} value={partyDraft.clientType} onChange={(event) => setPartyDraft((current) => ({ ...current, clientType: event.target.value }))} placeholder="Örn. Fer'i müdahil" /></label>
        <label className={partyStyles.modalWide}><span>Adres</span><textarea maxLength={2000} value={partyDraft.address} onChange={(event) => setPartyDraft((current) => ({ ...current, address: event.target.value }))} /></label>
        <label className={partyStyles.modalWide}><span>Açıklama</span><textarea maxLength={500} value={partyDraft.description} onChange={(event) => setPartyDraft((current) => ({ ...current, description: event.target.value }))} /></label>
      </div><footer><button type="button" className={partyStyles.back} onClick={() => setPartyModalOpen(false)}>Vazgeç</button><button type="button" onClick={savePartyDraft}>{editingPartyId ? "Değişiklikleri Kaydet" : "Tarafı Ekle"}</button></footer></section></div>}
    </form> : step === 2 ? <FinanceStep finance={finance} setFinance={setFinance} entries={financialEntries} setEntries={setFinancialEntries} onBack={() => setStep(1)} onSubmit={continueToProcess} saving={false} error={error} />
      : step === 3 ? <ProcessStep currentUser={currentUser} currentStage={form.stage} onStageChange={updateStage} entries={processEntries} setEntries={setProcessEntries} hearings={hearings} setHearings={setHearings} onBack={() => setStep(2)} onSubmit={continueToDocuments} error={error} />
        : step === 4 ? <DocumentsStep documents={documents} setDocuments={setDocuments} onBack={() => setStep(3)} onSubmit={continueToTasks} error={error} />
          : step === 5 ? <TaskStep currentUser={currentUser} tasks={tasks} setTasks={setTasks} onBack={() => setStep(4)} onSubmit={continueToNotes} error={error} />
            : <NoteStep notes={notes} setNotes={setNotes} onBack={() => setStep(5)} onSubmit={submit} saving={saving} error={error} />}
  </main></AppShell>;
}

function currentIstanbulDate() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

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
