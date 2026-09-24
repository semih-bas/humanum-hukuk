"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/app-shell/AppShell";
import { formatMoneyInput, limitDateYear } from "@/lib/form-input";
import { INSURANCE_CASE_TYPE_LABELS, INSURANCE_STATUS_LABELS, type InsuranceCaseType } from "@/lib/insurance-arbitration/presentation";
import PaymentSection, { type InsurancePaymentEntry } from "./PaymentSection";
import { DocumentsTab, NotesTab, type DocumentFolderConfig, type DraftDocument, type DraftNote } from "@/app/dosyalarim/yeni/CaseActivityTabs";
import styles from "./page.module.css";

type Errors = Record<string, string[] | undefined>;
type MoneyField = "insuranceSettlementOffer" | "postageExpense" | "enforcementExpense" | "arbitrationApplicationFee" | "expertFee" | "postalAmount" | "actualDepreciationAmount";
export type InsuranceCaseTab = "general" | "payments" | "note" | "notifications" | "documents";
const initialForm = { arbitrationApplicationNo: "", opposingInsuranceCompany: "", opposingPolicyNumber: "", policyExpiryDate: "", opposingVehicleOwner: "", opposingIdentityNumber: "", vehicleOwner: "", identityNumber: "", vehiclePlate: "", accidentDate: "", postalDeliveryDate: "", caseTypes: ["DEPRECIATION"] as InsuranceCaseType[], insuranceApplicationDate: "", insuranceSettlementOffer: "0", arbitrationApplicationDate: "", hasArbitration: false, arbitrationCaseNumber: "", status: "INSURANCE_APPLICATION", postageExpense: "0", enforcementExpense: "0", arbitrationApplicationFee: "0", expertFee: "0", postalAmount: "0", actualDepreciationAmount: "0", description: "" };

type ExistingCase = Partial<typeof initialForm> & { referenceNumber?: string; version?: number; payments?: Array<Omit<InsurancePaymentEntry, "clientId"> & { id: string }>; documents?: DraftDocument[]; documentFolders?: DocumentFolderConfig[]; notes?: DraftNote[] };

export default function NewInsuranceCaseForm({ caseId, initialData, readOnly = false, initialTab = "general", currentUserName = "Kullanıcı" }: { caseId?: string; initialData?: ExistingCase; readOnly?: boolean; initialTab?: InsuranceCaseTab; currentUserName?: string } = {}) {
  const router = useRouter();
  const [form, setForm] = useState(() => makeInitialForm(initialData)); const [tab, setTab] = useState<InsuranceCaseTab>(initialTab); const [payments, setPayments] = useState<InsurancePaymentEntry[]>(() => initialData?.payments?.map((payment) => ({ ...payment, clientId: payment.id })) ?? []); const [draftNotes, setDraftNotes] = useState<DraftNote[]>([]); const [draftDocuments, setDraftDocuments] = useState<DraftDocument[]>([]); const [documentFolders, setDocumentFolders] = useState<DocumentFolderConfig[]>(initialData?.documentFolders ?? []);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [errors, setErrors] = useState<Errors>({}); const [version, setVersion] = useState(initialData?.version);
  function update(name: keyof typeof initialForm, value: string | boolean | InsuranceCaseType[]) { setForm((current) => ({ ...current, [name]: value })); }
  function updateIdentity(name: "identityNumber" | "opposingIdentityNumber", value: string) { update(name, value.replace(/\D/g, "").slice(0, 11)); }
  function updateDate(name: keyof typeof initialForm, value: string) { setForm((current) => ({ ...current, [name]: limitDateYear(value, String(current[name])) })); }
  function setArbitration(value: boolean) { setForm((current) => ({ ...current, hasArbitration: value, ...(!value ? { arbitrationApplicationDate: "", arbitrationApplicationNo: "", arbitrationCaseNumber: "" } : {}) })); }
  function toggleCaseType(value: InsuranceCaseType) { setForm((current) => ({ ...current, caseTypes: current.caseTypes.includes(value) ? current.caseTypes.filter((item) => item !== value) : [...current.caseTypes, value] })); }
  function payload(nextPayments = payments) { return { ...form, ...(caseId ? { version } : {}), arbitrationApplicationNo: form.arbitrationApplicationNo || null, opposingPolicyNumber: form.opposingPolicyNumber || null, policyExpiryDate: form.policyExpiryDate || null, opposingVehicleOwner: form.opposingVehicleOwner || null, opposingIdentityNumber: form.opposingIdentityNumber || null, identityNumber: form.identityNumber || null, postalDeliveryDate: form.postalDeliveryDate || null, insuranceApplicationDate: form.insuranceApplicationDate || null, arbitrationApplicationDate: form.arbitrationApplicationDate || null, arbitrationCaseNumber: form.arbitrationCaseNumber || null, description: form.description || null, payments: nextPayments.map((payment) => ({ type: payment.type, paymentDate: payment.paymentDate, amount: payment.amount, commission: payment.commission, description: payment.description || null })) }; }
  async function changePayments(nextPayments: InsurancePaymentEntry[]) { setPayments(nextPayments); if (!caseId || readOnly) return; setError(""); const response = await fetch(`/api/insurance-arbitration/${encodeURIComponent(caseId)}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(nextPayments)) }); const body = await response.json(); if (!response.ok || !body.data) { setError(body.error?.message ?? "Ödeme kaydedilemedi."); return; } setVersion(body.data.version); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (saving) return; setSaving(true); setError(""); setErrors({});
    try {
      const response = await fetch(caseId ? `/api/insurance-arbitration/${encodeURIComponent(caseId)}` : "/api/insurance-arbitration", { method: caseId ? "PATCH" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      const body = await response.json();
      if (response.status === 409 && body.error?.code === "VERSION_CONFLICT") {
        window.alert(body.error.message);
        window.location.reload();
        return;
      }
      if (!response.ok || !body.data) {
        const nextErrors = body.error?.fields ?? {};
        setErrors(nextErrors);
        setError(Object.keys(nextErrors).length ? "" : body.error?.message ?? "Dosya kaydedilemedi.");
        setTab("general");
        setSaving(false);
        return;
      }
      if (!caseId && documentFolders.length) { const folders = await fetch(`/api/insurance-arbitration/${body.data.id}/documents`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folders: documentFolders }) }); if (!folders.ok) throw new Error("Dosya oluşturuldu ancak klasörler kaydedilemedi."); }
      if (!caseId) for (const document of draftDocuments) { if (!document.file) continue; const data = new FormData(); data.append("file", document.file); data.append("category", document.category); data.append("folderKey", document.folderKey ?? document.category); const upload = await fetch(`/api/insurance-arbitration/${body.data.id}/documents`, { method: "POST", credentials: "same-origin", body: data }); if (!upload.ok) throw new Error(`${document.originalName} yüklenemedi; dosya kaydı oluşturuldu.`); }
      if (!caseId) for (const note of [...draftNotes].reverse()) { const saved = await fetch(`/api/insurance-arbitration/${body.data.id}/notes`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: note.content }) }); if (!saved.ok) throw new Error("Dosya oluşturuldu ancak notlardan biri kaydedilemedi."); }
      router.push(`/sigorta-ve-tahkim?${caseId ? "updated" : "created"}=${encodeURIComponent(body.data.referenceNumber)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dosya kaydedilemedi."); setSaving(false); }
  }
  const text = (name: keyof typeof initialForm, label: string, required = false, type = "text", disabled = false) => <label><span>{label}{required && " *"}</span><input type={type} max={type === "date" ? "9999-12-31" : undefined} required={required} disabled={disabled} value={String(form[name])} onChange={(e) => type === "date" ? updateDate(name, e.target.value) : update(name, e.target.value)} />{errors[name]?.[0] && <small>{errors[name]?.[0]}</small>}</label>;
  const identity = (name: "identityNumber" | "opposingIdentityNumber", label: string) => <label><span>{label}</span><input inputMode="numeric" maxLength={11} value={form[name]} onChange={(e) => updateIdentity(name, e.target.value)} placeholder="En fazla 11 rakam" />{errors[name]?.[0] && <small>{errors[name]?.[0]}</small>}</label>;
  const money = (name: MoneyField, label: string) => <label><span>{label}</span><div className={styles.money}><input inputMode="decimal" value={form[name]} onChange={(e) => update(name, formatMoneyInput(e.target.value))} /><b>TL</b></div>{errors[name]?.[0] && <small>{errors[name]?.[0]}</small>}</label>;
  return <AppShell pageTitle={readOnly ? "Dosya Genel Bakışı" : caseId ? "Dosyayı Düzenle" : "Yeni Dosya"} pageSubtitle="Sigorta ve Tahkim"><main className={styles.page}><header className={styles.header}><div><Link href="/sigorta-ve-tahkim">←</Link><p>{initialData?.referenceNumber ? `${initialData.referenceNumber} · ` : ""}Sigorta ve tahkim dosya bilgileri.</p></div><div>{caseId && !readOnly ? <button type="button" aria-label="Düzenlemeyi kaydedip kapat" title="Kaydet ve kapat" onClick={() => (document.getElementById("insurance-case-form") as HTMLFormElement | null)?.requestSubmit()}>×</button> : <Link href="/sigorta-ve-tahkim">{readOnly ? "Kapat" : "İptal"}</Link>}{!readOnly && !caseId && <button form="insurance-case-form" disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet"}</button>}</div></header>
    <nav className={styles.tabs}>{([["general","Genel Bilgiler"],["payments","Ödemeler"],["note","Not"],["notifications","Bildirimler"],["documents","Belgeler"]] as Array<[InsuranceCaseTab,string]>).map(([key,label]) => <button type="button" key={key} className={tab === key ? styles.activeTab : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {error && <p className={styles.error}>{error}</p>}<form id="insurance-case-form" onSubmit={submit}><fieldset disabled={readOnly} className={styles.formFields}>
      {tab === "general" && <div className={styles.general}>
        <Section number="1" title="Karşı Taraf Bilgileri" tone="blue"><div className={styles.grid5}>{text("opposingInsuranceCompany", "Karşı Sigorta", true)}{text("opposingPolicyNumber", "Karşı Poliçe No")}{text("policyExpiryDate", "Poliçe Vadesi", false, "date")}{text("opposingVehicleOwner", "Karşı Araç Sahibi")}{identity("opposingIdentityNumber", "Karşı TC / VKN")}</div></Section>
        <Section number="2" title="Araç ve Kaza Bilgileri" tone="blue"><div className={styles.grid5}>{text("vehicleOwner", "Araç Sahibi / Müvekkil", true)}{identity("identityNumber", "TC / VKN")}{text("vehiclePlate", "Araç Plaka", true)}{text("accidentDate", "Kaza Tarihi", true, "date")}{text("postalDeliveryDate", "Posta Teslim", false, "date")}</div></Section>
        <Section number="3" title="Dosya Türü" tone="gold"><div className={styles.radios}>{Object.entries(INSURANCE_CASE_TYPE_LABELS).map(([value,label]) => <label key={value}><input type="checkbox" checked={form.caseTypes.includes(value as InsuranceCaseType)} onChange={() => toggleCaseType(value as InsuranceCaseType)} />{label}</label>)}</div>{errors.caseTypes?.[0] && <small>{errors.caseTypes[0]}</small>}</Section>
        <div className={styles.split}><Section number="4" title="Sigorta Bilgileri" tone="green"><div className={styles.grid2}>{text("insuranceApplicationDate", "Sigorta Başvurusu Tarihi", false, "date")}{money("insuranceSettlementOffer", "Sigorta Sulh Teklifi")}</div></Section><Section number="5" title="Tahkim Bilgileri" tone="cyan"><div className={styles.gridTahkim}><label><span>Tahkim Var / Yok</span><select value={form.hasArbitration ? "yes" : "no"} onChange={(e) => setArbitration(e.target.value === "yes")}><option value="no">Yok</option><option value="yes">Var</option></select></label>{text("arbitrationApplicationDate", "Tahkim Başvuru Tarihi", false, "date", !form.hasArbitration)}{text("arbitrationApplicationNo", "Tahkim Başvuru No", false, "text", !form.hasArbitration)}{text("arbitrationCaseNumber", "Tahkim Esas No", false, "text", !form.hasArbitration)}<label><span>Dosyanın Son Durumu</span><select value={form.status} onChange={(e) => update("status", e.target.value)}>{Object.entries(INSURANCE_STATUS_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div></Section></div>
        <Section number="6" title="Masraf Bilgileri" tone="purple"><div className={styles.grid6}>{money("postageExpense", "Pul Gideri")}{money("enforcementExpense", "İcra Masrafı")}{money("arbitrationApplicationFee", "Tahkim Başvuru Ücreti")}{money("expertFee", "Bilirkişi Ücreti")}{money("postalAmount", "Posta Rakamı")}{money("actualDepreciationAmount", "Gerçek Değer Kaybı")}</div></Section>
      </div>}
      {tab === "payments" && <PaymentSection payments={payments} onChange={(next) => void changePayments(next)} readOnly={readOnly} />}
      {tab === "note" && <div className={styles.activityTab} style={readOnly ? { pointerEvents: "none" } : undefined}><NotesTab caseId={caseId} initialItems={initialData?.notes ?? draftNotes} onDraftItemsChange={setDraftNotes} apiBase="/api/insurance-arbitration" currentUserName={currentUserName} /></div>}
      {tab === "notifications" && <section className={`${styles.tabPanel} ${styles.emptyTab}`}><h2>Bildirimler</h2><p>Bildirim yapısı sonraki aşamada bu alana eklenecek.</p></section>}
      {tab === "documents" && <div className={styles.activityTab}><DocumentsTab caseId={caseId} initialItems={initialData?.documents ?? draftDocuments} initialFolders={documentFolders} onDraftItemsChange={setDraftDocuments} onDraftFoldersChange={setDocumentFolders} apiBase="/api/insurance-arbitration" noun="Belge" readOnly={readOnly} /></div>}
    </fieldset></form></main></AppShell>;
}
function Section({ number, title, tone, children }: { number: string; title: string; tone: "blue" | "gold" | "green" | "cyan" | "purple"; children: React.ReactNode }) { return <section className={`${styles.section} ${styles[tone]}`}><h2><span>{number}</span>{title}</h2>{children}</section>; }
function makeInitialForm(data?: ExistingCase) { const values = { ...initialForm }; for (const key of Object.keys(values) as Array<keyof typeof initialForm>) { const value = data?.[key]; if (value !== undefined) Object.assign(values, { [key]: value }); } return values; }
