"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import AppShell from "@/components/app-shell/AppShell";
import { centsToMoneyString, formatMoneyInput, INSTALLMENT_OPTIONS, limitDateYear, parseMoneyToCents } from "@/lib/form-input";
import type { InstallmentCount } from "@/lib/cases/create-case-input";
import type { CaseStatus } from "@/lib/case-presentation";
import PaymentModal, { type DraftTransaction } from "../PaymentModal";
import { DocumentsTab, NotesTab, NotificationsTab, type DraftDocument, type DraftNote, type DraftReminder } from "./CaseActivityTabs";

import styles from "./page.module.css";

type Notice = { tone: "error" | "success"; message: string } | null;
type FieldErrors = Record<string, string[] | undefined>;
export type EnforcementCaseTab = "general" | "payments" | "notifications" | "notes" | "documents";
export type ExistingEnforcementCase = {
  id: string; referenceNumber: string; version: number; licenseHolder: string; vehiclePlate: string; accidentDate: string;
  debtorType: "INSURANCE_COMPANY" | "INDIVIDUAL" | "COMPANY"; debtorName: string | null;
  hasDamageClaim: boolean; hasDepreciationClaim: boolean; hasProfitLossClaim: boolean; judgmentStatus: "WITHOUT_JUDGMENT" | "WITH_JUDGMENT";
  damageAmount: string; depreciationAmount: string; profitLossDays: number | null; dailyRentalAmount: string | null; discountAmount: string;
  enforcementOffice: string | null; enforcementFileNumber: string | null; vehicleLien: boolean; bankLien: boolean; titleDeedLien: boolean; salaryLien: boolean;
  installmentCount: number | null; status: CaseStatus;
  notes: Array<{ id: string; content: string; createdAt: string; author: { name: string } }>;
  reminders: Array<{ id: string; title: string; dueAt: string; status: string }>;
  documents: Array<{ id: string; originalName: string; sizeBytes: number; category: string; createdAt: string }>;
};

function Icon({ name }: { name: "check" | "x" }) {
  const paths = {
    check: <path d="m5 12 4 4L19 6" />,
    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function FieldError({ errors, name }: { errors: FieldErrors; name: string }) {
  const message = errors[name]?.[0];
  return message ? <small className={styles.fieldError}>{message}</small> : null;
}

function AmountInput({
  label,
  value,
  onChange,
  readOnly = false,
  error,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  error?: string;
}) {
  return <label className={styles.field}>
    <span>{label}</span>
    <div className={`${styles.amountInput} ${readOnly ? styles.readOnly : ""} ${error ? styles.invalid : ""}`}>
      <input
        aria-invalid={Boolean(error)}
        inputMode="decimal"
        value={value}
        placeholder="0,00"
        readOnly={readOnly}
        onChange={(event) => onChange?.(formatMoneyInput(event.target.value))}
        onBlur={(event) => {
          const cents = parseMoneyToCents(event.target.value);
          if (onChange && cents !== null) onChange(centsToMoneyString(cents));
        }}
      />
      <b>TL</b>
    </div>
    {error && <small className={styles.fieldError}>{error}</small>}
  </label>;
}

export default function NewCaseForm({ caseId, initialData, initialTab = "general", readOnly = false }: { caseId?: string; initialData?: ExistingEnforcementCase; initialTab?: EnforcementCaseTab; readOnly?: boolean } = {}) {
  const router = useRouter();
  const [tab, setTab] = useState<EnforcementCaseTab>(initialTab);
  const [licenseHolder, setLicenseHolder] = useState(initialData?.licenseHolder ?? "");
  const [vehiclePlate, setVehiclePlate] = useState(initialData?.vehiclePlate ?? "");
  const [accidentDate, setAccidentDate] = useState(initialData?.accidentDate ?? "");
  const [debtorType, setDebtorType] = useState(initialData?.debtorType ?? "");
  const [debtorName, setDebtorName] = useState(initialData?.debtorName ?? "");
  const [hasDamageClaim, setHasDamageClaim] = useState(initialData?.hasDamageClaim ?? false);
  const [hasDepreciationClaim, setHasDepreciationClaim] = useState(initialData?.hasDepreciationClaim ?? false);
  const [hasProfitLossClaim, setHasProfitLossClaim] = useState(initialData?.hasProfitLossClaim ?? false);
  const [judgmentStatus, setJudgmentStatus] = useState<"WITHOUT_JUDGMENT" | "WITH_JUDGMENT">(initialData?.judgmentStatus ?? "WITHOUT_JUDGMENT");
  const [damage, setDamage] = useState(() => inputMoney(initialData?.damageAmount));
  const [depreciation, setDepreciation] = useState(() => inputMoney(initialData?.depreciationAmount));
  const [profitLossDays, setProfitLossDays] = useState(initialData?.profitLossDays ? String(initialData.profitLossDays) : "");
  const [dailyRental, setDailyRental] = useState(() => inputMoney(initialData?.dailyRentalAmount));
  const [discount, setDiscount] = useState(() => inputMoney(initialData?.discountAmount));
  const [enforcementOffice, setEnforcementOffice] = useState(initialData?.enforcementOffice ?? "");
  const [enforcementFileNumber, setEnforcementFileNumber] = useState(initialData?.enforcementFileNumber ?? "");
  const [vehicleLien, setVehicleLien] = useState(initialData?.vehicleLien ?? false);
  const [bankLien, setBankLien] = useState(initialData?.bankLien ?? false);
  const [titleDeedLien, setTitleDeedLien] = useState(initialData?.titleDeedLien ?? false);
  const [salaryLien, setSalaryLien] = useState(initialData?.salaryLien ?? false);
  const [installmentEnabled, setInstallmentEnabled] = useState(Boolean(initialData?.installmentCount));
  const [installmentCount, setInstallmentCount] = useState<InstallmentCount>((initialData?.installmentCount as InstallmentCount | null) ?? 3);
  const [status, setStatus] = useState(initialData?.status ?? "");
  const [notice, setNotice] = useState<Notice>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftTransactions, setDraftTransactions] = useState<DraftTransaction[]>([]);
  const [draftNotes, setDraftNotes] = useState<DraftNote[]>([]);
  const [draftReminders, setDraftReminders] = useState<DraftReminder[]>([]);
  const [draftDocuments, setDraftDocuments] = useState<DraftDocument[]>([]);

  const profitLoss = hasProfitLossClaim && profitLossDays
    ? centsToInput(BigInt(profitLossDays) * toCents(dailyRental))
    : "";

  const financials = useMemo(() => {
    const total = toCents(damage) + toCents(depreciation) + toCents(profitLoss);
    const net = total > toCents(discount) ? total - toCents(discount) : 0n;
    const monthly = installmentEnabled ? net / BigInt(installmentCount) : 0n;
    const remainder = installmentEnabled ? net % BigInt(installmentCount) : 0n;

    return {
      total: centsToInput(total),
      net: centsToInput(net),
      monthly: centsToInput(monthly),
      final: centsToInput(monthly + remainder),
    };
  }, [damage, depreciation, profitLoss, discount, installmentEnabled, installmentCount]);

  function changeInstallment(enabled: boolean) {
    setInstallmentEnabled(enabled);
    if (!enabled) setInstallmentCount(3);
  }

  function changeStatus(nextStatus: string) {
    setStatus(nextStatus);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;

    if (isSubmitting) {
      return;
    }

    if (!formElement.checkValidity()) {
      setTab("general");
      setNotice({ tone: "error", message: "Kaydetmeden önce işaretlenen zorunlu alanları tamamlayın." });
      requestAnimationFrame(() => formElement.reportValidity());
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setFieldErrors({});

    try {
      const response = await fetch(caseId ? `/api/cases/${encodeURIComponent(caseId)}` : "/api/cases", {
        method: caseId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseHolder,
          vehiclePlate,
          accidentDate,
          debtorType,
          debtorName: debtorName || null,
          hasDamageClaim,
          hasDepreciationClaim,
          hasProfitLossClaim,
          judgmentStatus,
          damageAmount: hasDamageClaim ? normalizeMoney(damage) : "0",
          depreciationAmount: hasDepreciationClaim ? normalizeMoney(depreciation) : "0",
          profitLossAmount: normalizeMoney(profitLoss),
          profitLossDays: hasProfitLossClaim ? Number(profitLossDays) : null,
          dailyRentalAmount: hasProfitLossClaim ? normalizeMoney(dailyRental) : null,
          discountAmount: normalizeMoney(discount),
          enforcementOffice: enforcementOffice || null,
          enforcementFileNumber: enforcementFileNumber || null,
          vehicleLien,
          bankLien,
          titleDeedLien,
          salaryLien,
          installmentCount: installmentEnabled ? installmentCount : null,
          status,
          ...(caseId ? { version: initialData?.version } : { note: null, reminder: null }),
        }),
      });
      const result = await response.json() as {
        data?: { id: string; referenceNumber: string };
        error?: { message?: string; fields?: FieldErrors };
      };

      if (!response.ok || !result.data) {
        setFieldErrors(result.error?.fields ?? {});
        setNotice({
          tone: "error",
          message: result.error?.message ?? "Dosya kaydedilemedi. Lütfen bilgileri kontrol edin.",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (!caseId) await persistDraftActivity(result.data.id, draftTransactions, draftNotes, draftReminders, draftDocuments);

      setNotice({ tone: "success", message: `${result.data.referenceNumber} numaralı dosya ${caseId ? "güncellendi" : "oluşturuldu"}.` });
      router.push(caseId ? `/dosyalarim?updated=${encodeURIComponent(result.data.referenceNumber)}` : `/dosyalarim/${encodeURIComponent(result.data.id)}/duzenle?created=${encodeURIComponent(result.data.referenceNumber)}`);
      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        message: "Sunucuya ulaşılamadı. İnternet bağlantısını kontrol edip tekrar deneyin.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return <AppShell pageTitle={readOnly ? "Dosya Genel Bakışı" : caseId ? "Dosyayı Düzenle" : "Yeni Dosya Kaydı"} pageSubtitle="İcra">
    <main className={styles.newCasePage}>
      <header className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <p>{initialData?.referenceNumber ? `${initialData.referenceNumber} · ` : ""}Dosya bilgilerini eksiksiz şekilde giriniz.</p>
        </div>
        <div className={styles.pageActions}>
          {caseId && !readOnly ? <button type="button" aria-label="Düzenlemeyi kaydedip kapat" title="Kaydet ve kapat" onClick={() => (document.getElementById("enforcement-case-form") as HTMLFormElement | null)?.requestSubmit()}><Icon name="x" /></button> : <Link href="/dosyalarim">{readOnly ? "Listeye Dön" : "İptal"}</Link>}
          {!readOnly && !caseId && <button type="submit" form="enforcement-case-form" disabled={isSubmitting}><Icon name="check" />{isSubmitting ? "Kaydediliyor..." : "Kaydet"}</button>}
        </div>
      </header>

      {notice && <p className={`${styles.notice} ${notice.tone === "error" ? styles.noticeError : ""}`} role={notice.tone === "error" ? "alert" : "status"}>
        {notice.message}
        <button type="button" aria-label="Bildirimi kapat" onClick={() => setNotice(null)}><Icon name="x" /></button>
      </p>}

      <nav className={styles.workspaceTabs}>{([["general", "Genel Bilgiler"], ["payments", "Ödemeler"], ["notifications", "Bildirimler"], ["notes", "Notlar"], ["documents", "Evraklar"]] as Array<[EnforcementCaseTab, string]>).map(([key, label]) => <button type="button" key={key} className={tab === key ? styles.activeWorkspaceTab : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>

      {tab === "payments" && <div className={styles.embeddedTab}><PaymentModal caseId={caseId} embedded readOnly={readOnly} draftItems={draftTransactions} onDraftItemsChange={setDraftTransactions} /></div>}
      {tab === "notifications" && <div className={styles.embeddedTab} style={readOnly ? { pointerEvents: "none" } : undefined}><NotificationsTab caseId={caseId} initialItems={initialData?.reminders ?? draftReminders} onDraftItemsChange={setDraftReminders} /></div>}
      {tab === "notes" && <div className={styles.embeddedTab} style={readOnly ? { pointerEvents: "none" } : undefined}><NotesTab caseId={caseId} initialItems={initialData?.notes ?? draftNotes} onDraftItemsChange={setDraftNotes} /></div>}
      {tab === "documents" && <div className={styles.embeddedTab} style={readOnly ? { pointerEvents: "none" } : undefined}><DocumentsTab caseId={caseId} initialItems={initialData?.documents ?? draftDocuments} onDraftItemsChange={setDraftDocuments} /></div>}

      <form id="enforcement-case-form" className={tab === "general" ? styles.generalTab : styles.hiddenTab} onSubmit={handleSubmit} noValidate>
      <fieldset disabled={readOnly} style={{ display: "contents" }}>

      <section className={styles.sectionCard}>
        <h2><span>1</span>Araç ve Taraf Bilgileri</h2>
        <div className={styles.partyColumns}>
          <label className={styles.field}><span>Ruhsat Sahibi</span><input required maxLength={150} value={licenseHolder} onChange={(event) => setLicenseHolder(event.target.value)} placeholder="Ruhsat sahibi adı soyadı" /><FieldError errors={fieldErrors} name="licenseHolder" /></label>
          <label className={styles.field}><span>Araç Plakası</span><input required maxLength={20} value={vehiclePlate} onChange={(event) => setVehiclePlate(event.target.value.toLocaleUpperCase("tr-TR"))} placeholder="34 ABC 123" /><FieldError errors={fieldErrors} name="vehiclePlate" /></label>
          <label className={styles.field}><span>Kaza Tarihi</span><input required type="date" max={todayDate()} value={accidentDate} onChange={(event) => setAccidentDate(limitDateYear(event.target.value, accidentDate))} /><FieldError errors={fieldErrors} name="accidentDate" /></label>
          <label className={styles.field}><span>Borçlu Türü</span><select required value={debtorType} onChange={(event) => setDebtorType(event.target.value)}><option value="" disabled>Tür seçiniz</option><option value="INSURANCE_COMPANY">Sigorta Şirketi</option><option value="INDIVIDUAL">Şahıs</option><option value="COMPANY">Şirket</option></select><FieldError errors={fieldErrors} name="debtorType" /></label>
          <label className={styles.field}><span>Borçlu Taraf</span><input required maxLength={150} value={debtorName} onChange={(event) => setDebtorName(event.target.value)} placeholder="Kişi veya şirket adı" /><FieldError errors={fieldErrors} name="debtorName" /></label>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <h2><span>2</span>Dosya Bilgileri</h2>
        <div className={styles.caseInfoGrid}>
          <fieldset className={styles.choiceGroup}>
            <legend>Dosya Türü</legend>
            <div className={styles.choicePanel}>
              <label><input type="checkbox" checked={hasDamageClaim} onChange={(event) => setHasDamageClaim(event.target.checked)} />Hasar Bedeli</label>
              <label><input type="checkbox" checked={hasDepreciationClaim} onChange={(event) => setHasDepreciationClaim(event.target.checked)} />Değer Kaybı</label>
              <label><input type="checkbox" checked={hasProfitLossClaim} onChange={(event) => setHasProfitLossClaim(event.target.checked)} />Kazanç Kaybı</label>
            </div>
            <FieldError errors={fieldErrors} name="hasDamageClaim" />
          </fieldset>
          <fieldset className={styles.choiceGroup}>
            <legend>İlam Durumu</legend>
            <div className={styles.radioRow}>
              <label><input type="radio" name="judgmentStatus" checked={judgmentStatus === "WITHOUT_JUDGMENT"} onChange={() => setJudgmentStatus("WITHOUT_JUDGMENT")} />İlamsız</label>
              <label><input type="radio" name="judgmentStatus" checked={judgmentStatus === "WITH_JUDGMENT"} onChange={() => setJudgmentStatus("WITH_JUDGMENT")} />İlamlı</label>
            </div>
          </fieldset>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <h2><span>3</span>Tutar ve Finansal Bilgiler</h2>
        <div className={styles.financialGrid}>
          <AmountInput label="Hesaplanan Hasar Bedeli Tutarı" value={hasDamageClaim ? damage : ""} onChange={setDamage} readOnly={!hasDamageClaim} error={fieldErrors.damageAmount?.[0]} />
          <AmountInput label="Hesaplanan Değer Kaybı Tutarı" value={hasDepreciationClaim ? depreciation : ""} onChange={setDepreciation} readOnly={!hasDepreciationClaim} error={fieldErrors.depreciationAmount?.[0]} />
          <div className={styles.profitLossBlock}>
            <span>Hesaplanan Kazanç Kaybı Tutarı</span>
            <div className={styles.profitFormula}>
              <label className={styles.compactNumber}><span>Gün</span><input disabled={!hasProfitLossClaim} type="number" min="1" max="36500" value={profitLossDays} onChange={(event) => setProfitLossDays(event.target.value.replace(/\D/g, ""))} placeholder="0" /></label>
              <b>×</b>
              <AmountInput label="Günlük Kira Bedeli" value={hasProfitLossClaim ? dailyRental : ""} onChange={setDailyRental} readOnly={!hasProfitLossClaim} error={fieldErrors.dailyRentalAmount?.[0]} />
              <b>=</b>
              <AmountInput label="Toplam Kazanç Kaybı" value={profitLoss} readOnly error={fieldErrors.profitLossAmount?.[0]} />
            </div>
            <FieldError errors={fieldErrors} name="profitLossDays" />
          </div>
          <AmountInput label="Talep Edilen Toplam Tutar" value={financials.total} readOnly />
          <AmountInput label="İndirim Tutarı" value={discount} onChange={setDiscount} error={fieldErrors.discountAmount?.[0]} />
          <AmountInput label="Net Talep Tutarı" value={financials.net} readOnly />
        </div>
      </section>

      <div className={styles.splitGrid}>
        <section className={styles.sectionCard}>
          <h2><span>4</span>İcra Bilgileri</h2>
          <div className={styles.twoColumns}>
            <label className={styles.field}><span>İcra Dairesi</span><input maxLength={150} value={enforcementOffice} onChange={(event) => setEnforcementOffice(event.target.value)} placeholder="İstanbul 12. İcra Dairesi" /><FieldError errors={fieldErrors} name="enforcementOffice" /></label>
            <label className={styles.field}><span>İcra Dosya Numarası</span><input maxLength={50} value={enforcementFileNumber} onChange={(event) => setEnforcementFileNumber(event.target.value)} placeholder="2026/12345" /><FieldError errors={fieldErrors} name="enforcementFileNumber" /></label>
          </div>
        </section>
        <section className={styles.sectionCard}>
          <h2><span>5</span>Haciz Bilgileri</h2>
          <div className={styles.fourToggleGrid}>
            <Toggle label="Araç Haczi" checked={vehicleLien} onChange={setVehicleLien} />
            <Toggle label="Banka Haczi" checked={bankLien} onChange={setBankLien} />
            <Toggle label="Tapu Haczi" checked={titleDeedLien} onChange={setTitleDeedLien} />
            <Toggle label="Maaş Haczi" checked={salaryLien} onChange={setSalaryLien} />
          </div>
        </section>
      </div>

      <div className={styles.bottomGrid}>
        <section className={styles.sectionCard}>
          <h2><span>6</span>Dosya Durumu</h2>
          <label className={styles.field}><span>Dosya Durumu</span><select required value={status} onChange={(event) => changeStatus(event.target.value)}><option value="" disabled>Dosya durumunu seçiniz</option><option value="OPEN">Devam Ediyor</option><option value="ENFORCEMENT">İcra Takibinde</option><option value="INSTALLMENT">Taksitli Ödeme</option><option value="PENDING">Beklemede</option><option value="CLOSED">Sonuçlandı</option></select><FieldError errors={fieldErrors} name="status" /></label>
        </section>
        <section className={styles.sectionCard}>
          <h2><span>7</span>Taksit Bilgileri</h2>
          <div className={styles.installmentGrid}>
            <label className={styles.field}><span>Taksit Var mı?</span><select value={installmentEnabled ? "yes" : "no"} onChange={(event) => changeInstallment(event.target.value === "yes")}><option value="no">Hayır</option><option value="yes">Evet</option></select></label>
            {installmentEnabled && <>
              <label className={styles.field}><span>Toplam Taksit Sayısı</span><select value={installmentCount} onChange={(event) => setInstallmentCount(Number(event.target.value) as InstallmentCount)}>{INSTALLMENT_OPTIONS.map((count) => <option value={count} key={count}>{count} Ay</option>)}</select><FieldError errors={fieldErrors} name="installmentCount" /></label>
              <AmountInput label="Taksit Tutarı" value={financials.monthly} readOnly />
            </>}
          </div>
        </section>
      </div></fieldset>
      </form>
    </main>

  </AppShell>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={styles.toggle}><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /><small>{checked ? "Evet" : "Hayır"}</small></label>;
}

function normalizeMoney(value: string): string {
  return value.trim() || "0";
}

function inputMoney(value?: string | null): string {
  if (!value) return "";
  const cents = parseMoneyToCents(value);
  return cents === null ? "" : centsToMoneyString(cents);
}

function toCents(value: string): bigint {
  return parseMoneyToCents(value) ?? 0n;
}

function centsToInput(value: bigint): string {
  return centsToMoneyString(value);
}

function todayDate(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

async function persistDraftActivity(caseId: string, transactions: DraftTransaction[], notes: DraftNote[], reminders: DraftReminder[], documents: DraftDocument[]) {
  for (const item of transactions) {
    const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/transactions`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: item.type, category: item.category, transactionDate: item.transactionDate, amount: item.amount, description: item.description }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Taslak ödeme kaydedilemedi.");
    for (const file of item.files ?? []) { const data = new FormData(); data.set("file", file); data.set("documentName", file.name.replace(/\.[^.]+$/, "")); if(body.data?.createdTransactionId)data.set("transactionId",body.data.createdTransactionId); const upload=await fetch(`/api/cases/${encodeURIComponent(caseId)}/documents`,{method:"POST",credentials:"same-origin",body:data}); if(!upload.ok)throw new Error(`${file.name} yüklenemedi.`); }
  }
  for (const item of notes) { const response=await fetch(`/api/cases/${encodeURIComponent(caseId)}/notes`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:item.content})});if(!response.ok)throw new Error("Taslak not kaydedilemedi."); }
  for (const item of reminders) { const response=await fetch(`/api/cases/${encodeURIComponent(caseId)}/reminders`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:item.title,dueAt:item.dueAt})});if(!response.ok)throw new Error("Taslak bildirim kaydedilemedi."); }
  for (const item of documents) { if(!item.file)continue;const data=new FormData();data.set("file",item.file);data.set("documentName",item.originalName.replace(/\.[^.]+$/, ""));data.set("category",item.category);const response=await fetch(`/api/cases/${encodeURIComponent(caseId)}/documents`,{method:"POST",credentials:"same-origin",body:data});if(!response.ok)throw new Error(`${item.originalName} yüklenemedi.`); }
}
