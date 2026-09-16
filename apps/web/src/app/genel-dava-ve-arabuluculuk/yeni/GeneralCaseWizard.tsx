"use client";

import AppShell from "@/components/app-shell/AppShell";
import { formatMoneyInput, limitDateYear } from "@/lib/form-input";
import Link from "next/link";
import { FormEvent, useState } from "react";
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
export type GeneralCaseDraft = typeof initialForm;

export default function GeneralCaseWizard({ currentUser }: { currentUser: { id: string; name: string } }) {
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(0);
  function update(name: keyof GeneralCaseDraft, value: string | boolean) { setForm((current) => ({ ...current, [name]: value })); }
  function continueToParties(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setStep(1); }
  const litigation = form.kind === "GENERAL_LITIGATION";

  return <AppShell><main className={styles.page}>
    <header className={styles.header}><div><Link href="/genel-dava-ve-arabuluculuk" aria-label="Listeye dön">←</Link><div><h1>Yeni Dosya</h1><p>Genel dava veya arabuluculuk kaydı oluşturun.</p></div></div><Link href="/genel-dava-ve-arabuluculuk" className={styles.cancel}>Vazgeç</Link></header>
    <nav className={styles.steps} aria-label="Dosya oluşturma adımları">{steps.map((label, index) => <button type="button" key={label} className={index === step ? styles.activeStep : index < step ? styles.doneStep : ""} disabled={index > 1} onClick={() => index <= 1 && setStep(index)}><b>{index + 1}</b><span>{label}</span></button>)}</nav>
    {step === 0 ? <form className={styles.form} onSubmit={continueToParties}>
      <section className={styles.panel}><h2>Dosya Bilgileri</h2><div className={styles.grid3}>
        <label><span>Dosya Alanı *</span><select value={form.kind} onChange={(event) => update("kind", event.target.value)}><option value="GENERAL_LITIGATION">Genel Dava</option><option value="MEDIATION">Arabuluculuk</option></select></label>
        <label><span>Dosya Türü *</span><input required maxLength={100} value={form.caseType} onChange={(event) => update("caseType", event.target.value)} placeholder={litigation ? "Örn. Tazminat" : "Örn. Ticari uyuşmazlık"} /></label>
        <label><span>Açılış Tarihi *</span><input required type="date" max="9999-12-31" value={form.openingDate} onChange={(event) => update("openingDate", limitDateYear(event.target.value, form.openingDate))} /></label>
        <label className={styles.span2}><span>Dosya Konusu *</span><input required maxLength={4000} value={form.subject} onChange={(event) => update("subject", event.target.value)} placeholder="Uyuşmazlığın veya davanın kısa konusu" /></label>
        <label><span>Dosya Değeri</span><div className={styles.money}><input inputMode="decimal" value={form.caseValue} onChange={(event) => update("caseValue", formatMoneyInput(event.target.value))} /><b>TL</b></div></label>
      </div></section>
      <section className={styles.panel}><h2>{litigation ? "Mahkeme ve UYAP Bilgileri" : "Arabuluculuk Bilgileri"}</h2><div className={styles.grid3}>
        {litigation && <><label><span>Adliye *</span><input required maxLength={150} value={form.courthouse} onChange={(event) => update("courthouse", event.target.value)} /></label><label><span>Mahkeme Türü *</span><input required maxLength={100} value={form.courtType} onChange={(event) => update("courtType", event.target.value)} placeholder="Örn. Asliye Hukuk" /></label><label><span>Mahkeme *</span><input required maxLength={150} value={form.court} onChange={(event) => update("court", event.target.value)} placeholder="Örn. İstanbul 8. Asliye Hukuk" /></label></>}
        <label><span>{litigation ? "UYAP Esas No" : "Arabuluculuk Dosya No"}</span><input maxLength={80} value={form.uyapMainNumber} onChange={(event) => update("uyapMainNumber", event.target.value)} /></label>
        <label><span>{litigation ? "UYAP Karar No" : "Son Tutanak No"}</span><input maxLength={80} value={form.uyapDecisionNumber} onChange={(event) => update("uyapDecisionNumber", event.target.value)} /></label>
        <label><span>Takip Eden Ofis</span><input maxLength={100} value={form.office} onChange={(event) => update("office", event.target.value)} /></label>
      </div></section>
      <section className={styles.panel}><h2>Süreç ve Sorumluluk</h2><div className={styles.grid4}>
        <label><span>Dosya Durumu *</span><select value={form.status} onChange={(event) => update("status", event.target.value)}><option value="DRAFT">Taslak</option><option value="ACTIVE">Devam Ediyor</option><option value="DECISION">Karar</option><option value="APPEAL">Kanun Yolu</option><option value="COMPLETED">Sonuçlandı</option><option value="CLOSED">Kapalı</option></select></label>
        <label><span>Dosya Aşaması *</span><select value={form.stage} onChange={(event) => update("stage", event.target.value)}>{stages.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Sorumlu Kullanıcı</span><input value={currentUser.name} readOnly /></label>
        <label><span>Tahmini Sonuç Tarihi</span><input type="date" max="9999-12-31" value={form.estimatedCompletionDate} onChange={(event) => update("estimatedCompletionDate", limitDateYear(event.target.value, form.estimatedCompletionDate))} /></label>
        <label><span>Usul / Yöntem</span><input maxLength={100} value={form.procedure} onChange={(event) => update("procedure", event.target.value)} /></label>
        <label><span>Takip Grubu</span><input maxLength={100} value={form.trackingGroup} onChange={(event) => update("trackingGroup", event.target.value)} /></label>
        <label><span>Gizlilik</span><select value={form.confidentiality} onChange={(event) => update("confidentiality", event.target.value)}><option value="NORMAL">Normal</option><option value="RESTRICTED">Kısıtlı</option></select></label>
        <label className={styles.check}><input type="checkbox" checked={form.urgent} onChange={(event) => update("urgent", event.target.checked)} /><span>Acil dosya</span></label>
      </div></section>
      <section className={styles.panel}><h2>Etiket ve Açıklama</h2><div className={styles.grid2}><label><span>Etiketler</span><input value={form.tags} onChange={(event) => update("tags", event.target.value)} placeholder="Virgülle ayırın: tazminat, ticari" /></label><label><span>Açıklama</span><textarea maxLength={4000} value={form.description} onChange={(event) => update("description", event.target.value)} /></label></div></section>
      <footer><span>1 / 7 · Genel Bilgiler</span><button type="submit">Taraflara İlerle →</button></footer>
    </form> : <section className={styles.nextPlaceholder}><h2>Taraflar</h2><p>Genel bilgiler korunuyor. Sıradaki küçük parçada çoklu taraf ekleme alanı bu adıma bağlanacak.</p><button type="button" onClick={() => setStep(0)}>← Genel Bilgilere Dön</button></section>}
  </main></AppShell>;
}

function currentIstanbulDate() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
