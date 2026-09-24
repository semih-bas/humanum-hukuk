"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import AppShell from "@/components/app-shell/AppShell";
import { centsToMoneyString, formatMoneyInput, limitDateYear, parseMoneyToCents } from "@/lib/form-input";
import { debtorTypeLabel, type CaseDebtor, type DebtorType } from "@/lib/cases/case-debtors";
import type { CaseStatus } from "@/lib/case-presentation";
import PaymentModal, { type DraftTransaction } from "../PaymentModal";
import { DocumentsTab, NotesTab, NotificationsTab, type DocumentFolderConfig, type DraftDocument, type DraftNote, type DraftReminder } from "./CaseActivityTabs";

import styles from "./page.module.css";

type Notice = { tone: "error" | "success"; message: string } | null;
type FieldErrors = Record<string, string[] | undefined>;
export type EnforcementCaseTab = "general" | "payments" | "notifications" | "notes" | "documents";
export type ExistingEnforcementCase = {
  id: string; referenceNumber: string; version: number; licenseHolder: string; vehiclePlate: string; accidentDate: string;
  debtorType: "INSURANCE_COMPANY" | "INDIVIDUAL" | "COMPANY"; debtorName: string | null;
  debtors: CaseDebtor[];
  hasDamageClaim: boolean; hasDepreciationClaim: boolean; hasProfitLossClaim: boolean; judgmentStatus: "WITHOUT_JUDGMENT" | "WITH_JUDGMENT";
  damageAmount: string; depreciationAmount: string; profitLossDays: number | null; dailyRentalAmount: string | null; discountAmount: string;
  enforcementOffice: string | null; enforcementFileNumber: string | null; vehicleLien: boolean; bankLien: boolean; titleDeedLien: boolean; salaryLien: boolean;
  installmentCount: number | null; status: CaseStatus;
  notes: Array<{ id: string; content: string; createdAt: string; author: { name: string } }>;
  reminders: Array<{ id: string; title: string; dueAt: string; status: string }>;
  documents: Array<{ id: string; originalName: string; mimeType?: string; sizeBytes: number; category: string; folderKey?: string | null; createdAt: string }>;
  documentFolders: DocumentFolderConfig[];
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

export default function NewCaseForm({ caseId, initialData, initialTab = "general", readOnly = false, currentUserName = "Kullanıcı" }: { caseId?: string; initialData?: ExistingEnforcementCase; initialTab?: EnforcementCaseTab; readOnly?: boolean; currentUserName?: string } = {}) {
  const router = useRouter();
  const [tab, setTab] = useState<EnforcementCaseTab>(initialTab);
  const [licenseHolder, setLicenseHolder] = useState(initialData?.licenseHolder ?? "");
  const [vehiclePlate, setVehiclePlate] = useState(initialData?.vehiclePlate ?? "");
  const [accidentDate, setAccidentDate] = useState(initialData?.accidentDate ?? "");
  const [debtors, setDebtors] = useState<CaseDebtor[]>(() => initialCaseDebtors(initialData));
  const [newDebtorType, setNewDebtorType] = useState<DebtorType>("INSURANCE_COMPANY");
  const [newDebtorName, setNewDebtorName] = useState("");
  const [showAllDebtors, setShowAllDebtors] = useState(false);
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
  const [installmentCount, setInstallmentCount] = useState(String(initialData?.installmentCount ?? 3));
  const [status, setStatus] = useState(initialData?.status ?? "");
  const [notice, setNotice] = useState<Notice>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftTransactions, setDraftTransactions] = useState<DraftTransaction[]>([]);
  const [draftNotes, setDraftNotes] = useState<DraftNote[]>([]);
  const [draftReminders, setDraftReminders] = useState<DraftReminder[]>([]);
  const [draftDocuments, setDraftDocuments] = useState<DraftDocument[]>([]);
  const [draftDocumentFolders, setDraftDocumentFolders] = useState<DocumentFolderConfig[]>(initialData?.documentFolders ?? []);

  const profitLoss = hasProfitLossClaim && profitLossDays
    ? centsToInput(BigInt(profitLossDays) * toCents(dailyRental))
    : "";

  const financials = useMemo(() => {
    const total = toCents(damage) + toCents(depreciation) + toCents(profitLoss);
    const net = total > toCents(discount) ? total - toCents(discount) : 0n;
    const validInstallmentCount = parseInstallmentCount(installmentCount);
    const divisor = BigInt(validInstallmentCount ?? 1);
    const monthly = installmentEnabled && validInstallmentCount ? net / divisor : 0n;
    const remainder = installmentEnabled && validInstallmentCount ? net % divisor : 0n;

    return {
      total: centsToInput(total),
      net: centsToInput(net),
      monthly: centsToInput(monthly),
      final: centsToInput(monthly + remainder),
    };
  }, [damage, depreciation, profitLoss, discount, installmentEnabled, installmentCount]);

  const hasUnsavedGeneralChanges = Boolean(caseId && initialData && (
    licenseHolder !== initialData.licenseHolder || vehiclePlate !== initialData.vehiclePlate || accidentDate !== initialData.accidentDate ||
    !sameDebtors(debtors, initialCaseDebtors(initialData)) || hasDamageClaim !== initialData.hasDamageClaim ||
    hasDepreciationClaim !== initialData.hasDepreciationClaim || hasProfitLossClaim !== initialData.hasProfitLossClaim || judgmentStatus !== initialData.judgmentStatus ||
    !sameMoney(damage, initialData.damageAmount) || !sameMoney(depreciation, initialData.depreciationAmount) ||
    (hasProfitLossClaim ? Number(profitLossDays) : null) !== initialData.profitLossDays ||
    (hasProfitLossClaim ? !sameMoney(dailyRental, initialData.dailyRentalAmount) : initialData.dailyRentalAmount !== null) || !sameMoney(discount, initialData.discountAmount) ||
    enforcementOffice !== (initialData.enforcementOffice ?? "") || enforcementFileNumber !== (initialData.enforcementFileNumber ?? "") ||
    vehicleLien !== initialData.vehicleLien || bankLien !== initialData.bankLien || titleDeedLien !== initialData.titleDeedLien || salaryLien !== initialData.salaryLien ||
    (installmentEnabled ? Number(installmentCount) : null) !== initialData.installmentCount || status !== initialData.status
  ));

  function closeExistingCase() {
    if (hasUnsavedGeneralChanges) (document.getElementById("enforcement-case-form") as HTMLFormElement | null)?.requestSubmit();
    else router.push("/dosyalarim");
  }

  function changeInstallment(enabled: boolean) {
    setInstallmentEnabled(enabled);
    if (!enabled) setInstallmentCount("3");
  }

  function changeStatus(nextStatus: string) {
    setStatus(nextStatus);
  }

  function addDebtor() {
    const name = newDebtorName.trim();
    if (!name) {
      setFieldErrors((current) => ({ ...current, debtors: ["Borçlu taraf adını yazın."] }));
      return;
    }
    if (debtors.length >= 50) {
      setFieldErrors((current) => ({ ...current, debtors: ["En fazla 50 borçlu eklenebilir."] }));
      return;
    }
    if (debtors.some((item) => item.type === newDebtorType && item.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) {
      setFieldErrors((current) => ({ ...current, debtors: ["Bu borçlu zaten eklenmiş."] }));
      return;
    }
    setDebtors((current) => [...current, { type: newDebtorType, name }]);
    setNewDebtorName("");
    setFieldErrors((current) => ({ ...current, debtors: undefined }));
  }

  function removeDebtor(index: number) {
    setDebtors((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      if (next.length <= 2) setShowAllDebtors(false);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;

    if (isSubmitting) {
      return;
    }

    if (!debtors.length) {
      setTab("general");
      setNotice(null);
      setFieldErrors((current) => ({ ...current, debtors: ["En az bir borçlu eklenmelidir."] }));
      return;
    }

    if (!formElement.checkValidity()) {
      setTab("general");
      setNotice(null);
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
          debtorType: debtors[0].type,
          debtorName: debtors[0].name,
          debtors,
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
          installmentCount: installmentEnabled ? Number(installmentCount) : null,
          status,
          ...(caseId ? { version: initialData?.version } : { note: null, reminder: null }),
        }),
      });
      const result = await response.json() as {
        data?: { id: string; referenceNumber: string };
        error?: { message?: string; fields?: FieldErrors };
      };

      if (!response.ok || !result.data) {
        const nextFieldErrors = result.error?.fields ?? {};
        setFieldErrors(nextFieldErrors);
        setNotice(Object.keys(nextFieldErrors).length ? null : {
          tone: "error",
          message: result.error?.message ?? "Dosya kaydedilemedi. Lütfen bilgileri kontrol edin.",
        });
        return;
      }

      if (!caseId) await persistDraftActivity(result.data.id, draftTransactions, draftNotes, draftReminders, draftDocuments, draftDocumentFolders);

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
          {caseId && !readOnly ? <button type="button" aria-label={hasUnsavedGeneralChanges ? "Değişiklikleri kaydedip kapat" : "Dosyalar listesine dön"} title={hasUnsavedGeneralChanges ? "Kaydet ve kapat" : "Kapat"} onClick={closeExistingCase}><Icon name="x" /></button> : <Link href="/dosyalarim">{readOnly ? "Listeye Dön" : "İptal"}</Link>}
          {!readOnly && (!caseId || tab === "general") && <button type="submit" form="enforcement-case-form" disabled={isSubmitting}><Icon name="check" />{isSubmitting ? "Kaydediliyor..." : "Kaydet"}</button>}
        </div>
      </header>

      {notice && <p className={`${styles.notice} ${notice.tone === "error" ? styles.noticeError : ""}`} role={notice.tone === "error" ? "alert" : "status"}>
        {notice.message}
        <button type="button" aria-label="Bildirimi kapat" onClick={() => setNotice(null)}><Icon name="x" /></button>
      </p>}

      <nav className={styles.workspaceTabs}>{([["general", "Genel Bilgiler"], ["payments", "Ödemeler"], ["notifications", "Bildirimler"], ["notes", "Notlar"], ["documents", "Evraklar"]] as Array<[EnforcementCaseTab, string]>).map(([key, label]) => <button type="button" key={key} className={tab === key ? styles.activeWorkspaceTab : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>

      {tab === "payments" && <div className={styles.embeddedTab}><PaymentModal caseId={caseId} embedded readOnly={readOnly} draftItems={draftTransactions} onDraftItemsChange={setDraftTransactions} /></div>}
      {tab === "notifications" && <div className={styles.embeddedTab} style={readOnly ? { pointerEvents: "none" } : undefined}><NotificationsTab caseId={caseId} initialItems={initialData?.reminders ?? draftReminders} onDraftItemsChange={setDraftReminders} /></div>}
      {tab === "notes" && <div className={styles.embeddedTab} style={readOnly ? { pointerEvents: "none" } : undefined}><NotesTab caseId={caseId} initialItems={initialData?.notes ?? draftNotes} onDraftItemsChange={setDraftNotes} currentUserName={currentUserName} /></div>}
      {tab === "documents" && <div className={styles.embeddedTab}><DocumentsTab caseId={caseId} initialItems={initialData?.documents ?? draftDocuments} initialFolders={draftDocumentFolders} onDraftItemsChange={setDraftDocuments} onDraftFoldersChange={setDraftDocumentFolders} readOnly={readOnly} /></div>}

      <form id="enforcement-case-form" className={tab === "general" ? styles.generalTab : styles.hiddenTab} onSubmit={handleSubmit} noValidate>
      <fieldset disabled={readOnly} style={{ display: "contents" }}>

      <section className={styles.sectionCard}>
        <h2><span>1</span>Araç ve Taraf Bilgileri</h2>
        <div className={styles.partyLayout}>
          <div className={styles.vehicleFields}>
            <label className={styles.field}><span>Ruhsat Sahibi</span><input required maxLength={150} value={licenseHolder} onChange={(event) => setLicenseHolder(event.target.value)} placeholder="Ruhsat sahibi adı soyadı" /><FieldError errors={fieldErrors} name="licenseHolder" /></label>
            <label className={styles.field}><span>Araç Plakası</span><input required maxLength={20} value={vehiclePlate} onChange={(event) => setVehiclePlate(event.target.value.toLocaleUpperCase("tr-TR"))} placeholder="34 ABC 123" /><FieldError errors={fieldErrors} name="vehiclePlate" /></label>
            <label className={`${styles.field} ${styles.accidentField}`}><span>Kaza Tarihi</span><input required type="date" max={todayDate()} value={accidentDate} onChange={(event) => setAccidentDate(limitDateYear(event.target.value, accidentDate))} /><FieldError errors={fieldErrors} name="accidentDate" /></label>
          </div>
          <section className={styles.debtorsPanel} aria-labelledby="debtors-title">
            <h3 id="debtors-title">Borçlular</h3>
            <div className={styles.debtorComposer}>
              <label className={styles.field}><span>Borçlu Türü</span><select value={newDebtorType} onChange={(event) => setNewDebtorType(event.target.value as DebtorType)}><option value="INSURANCE_COMPANY">Sigorta Şirketi</option><option value="INDIVIDUAL">Şahıs</option><option value="COMPANY">Şirket</option></select></label>
              <label className={styles.field}><span>Borçlu Taraf</span><input maxLength={150} value={newDebtorName} onChange={(event) => setNewDebtorName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDebtor(); } }} placeholder="Kişi veya şirket adı" /></label>
              <button className={styles.addDebtorButton} type="button" onClick={addDebtor}>+ Ekle</button>
            </div>
            <div className={styles.addedDebtors}>
              <span>Eklenen Borçlular</span>
              {debtors.length ? <div className={styles.debtorRows}>{debtors.slice(0, 2).map((debtor, index) => <div className={styles.debtorRow} key={`${debtor.type}-${debtor.name}-${index}`}><b>{debtorTypeLabel(debtor.type)}</b><span>{debtor.name}</span><button type="button" aria-label={`${debtor.name} borçlusunu kaldır`} onClick={() => removeDebtor(index)}>×</button></div>)}{debtors.length > 2 && <button className={styles.moreDebtorsButton} type="button" onClick={() => setShowAllDebtors(true)}>+{debtors.length - 2}</button>}</div> : <p>Henüz borçlu eklenmedi.</p>}
            </div>
            <FieldError errors={fieldErrors} name="debtors" />
          </section>
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
              <label className={styles.field}><span>Toplam Taksit Sayısı</span><input required type="number" inputMode="numeric" min={1} max={12} step={1} value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} placeholder="1-12" /><FieldError errors={fieldErrors} name="installmentCount" /></label>
              <AmountInput label="Taksit Tutarı" value={financials.monthly} readOnly />
            </>}
          </div>
        </section>
      </div></fieldset>
      </form>
    </main>
    {showAllDebtors && <DebtorsModal debtors={debtors} readOnly={readOnly} onClose={() => setShowAllDebtors(false)} onRemove={removeDebtor} />}
  </AppShell>;
}

function DebtorsModal({ debtors, readOnly, onClose, onRemove }: { debtors: CaseDebtor[]; readOnly: boolean; onClose: () => void; onRemove: (index: number) => void }) {
  return createPortal(<div className={styles.debtorModalBackdrop} role="presentation" onMouseDown={onClose}>
    <section className={styles.debtorModal} role="dialog" aria-modal="true" aria-labelledby="all-debtors-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span>Borçlu Listesi</span><h2 id="all-debtors-title">Tüm Borçlular ({debtors.length})</h2></div><button type="button" aria-label="Pencereyi kapat" onClick={onClose}>×</button></header>
      <div className={styles.debtorModalList}>{debtors.map((debtor, index) => <div key={`${debtor.type}-${debtor.name}-${index}`}><b>{debtorTypeLabel(debtor.type)}</b><span>{debtor.name}</span>{!readOnly && <button type="button" aria-label={`${debtor.name} borçlusunu kaldır`} onClick={() => onRemove(index)}>Kaldır</button>}</div>)}</div>
      <footer><button type="button" onClick={onClose}>Kapat</button></footer>
    </section>
  </div>, document.body);
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={styles.toggle}><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /><small>{checked ? "Evet" : "Hayır"}</small></label>;
}

function normalizeMoney(value: string): string {
  return value.trim() || "0";
}

function sameMoney(input: string, persisted: string | null): boolean {
  return (parseMoneyToCents(input) ?? 0n) === (parseMoneyToCents(persisted ?? "") ?? 0n);
}

function initialCaseDebtors(initialData?: ExistingEnforcementCase): CaseDebtor[] {
  if (initialData?.debtors?.length) return initialData.debtors;
  return initialData?.debtorName ? [{ type: initialData.debtorType, name: initialData.debtorName }] : [];
}

function sameDebtors(left: CaseDebtor[], right: CaseDebtor[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseInstallmentCount(value: string): number | null {
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= 12 ? count : null;
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

async function persistDraftActivity(caseId: string, transactions: DraftTransaction[], notes: DraftNote[], reminders: DraftReminder[], documents: DraftDocument[], folders: DocumentFolderConfig[]) {
  if (folders.length) { const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/documents`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folders }) }); if (!response.ok) throw new Error("Taslak klasörler kaydedilemedi."); }
  for (const item of transactions) {
    const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/transactions`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: item.type, category: item.category, transactionDate: item.transactionDate, amount: item.amount, description: item.description }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Taslak ödeme kaydedilemedi.");
    for (const file of item.files ?? []) { const data = new FormData(); data.set("file", file); data.set("documentName", file.name.replace(/\.[^.]+$/, "")); if(body.data?.createdTransactionId)data.set("transactionId",body.data.createdTransactionId); const upload=await fetch(`/api/cases/${encodeURIComponent(caseId)}/documents`,{method:"POST",credentials:"same-origin",body:data}); if(!upload.ok)throw new Error(`${file.name} yüklenemedi.`); }
  }
  for (const item of notes) { const response=await fetch(`/api/cases/${encodeURIComponent(caseId)}/notes`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:item.content})});if(!response.ok)throw new Error("Taslak not kaydedilemedi."); }
  for (const item of reminders) { const response=await fetch(`/api/cases/${encodeURIComponent(caseId)}/reminders`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:item.title,dueAt:item.dueAt})});if(!response.ok)throw new Error("Taslak bildirim kaydedilemedi."); }
  for (const item of documents) { if(!item.file)continue;const data=new FormData();data.set("file",item.file);data.set("documentName",item.originalName.replace(/\.[^.]+$/, ""));data.set("category",item.category);data.set("folderKey",item.folderKey ?? item.category);const response=await fetch(`/api/cases/${encodeURIComponent(caseId)}/documents`,{method:"POST",credentials:"same-origin",body:data});if(!response.ok)throw new Error(`${item.originalName} yüklenemedi.`); }
}
