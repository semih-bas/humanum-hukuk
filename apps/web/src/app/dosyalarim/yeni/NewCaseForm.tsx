"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import AppShell from "@/components/app-shell/AppShell";
import { centsToMoneyString, formatMoneyInput, formatTimeInput, INSTALLMENT_OPTIONS, isValidTime, limitDateYear, parseMoneyToCents } from "@/lib/form-input";
import type { InstallmentCount } from "@/lib/cases/create-case-input";

import styles from "./page.module.css";

type Operation = "note" | "reminder" | "document" | null;
type Notice = { tone: "error" | "success"; message: string } | null;
type FieldErrors = Record<string, string[] | undefined>;

type ReminderDraft = {
  title: string;
  dueAt: string;
};

const emptyReminder: ReminderDraft = {
  title: "",
  dueAt: "",
};

function Icon({ name }: { name: "bell" | "check" | "document" | "note" | "x" }) {
  const paths = {
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    document: <><path d="M6 3h9l3 3v15H6Z" /><path d="M14 3v4h4M9 12h6M9 16h4" /></>,
    note: <><path d="M4 4h12v16H4Z" /><path d="m14 4 4 4M8 9h5M8 13h5" /></>,
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

export default function NewCaseForm() {
  const router = useRouter();
  const [licenseHolder, setLicenseHolder] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [accidentDate, setAccidentDate] = useState("");
  const [debtorType, setDebtorType] = useState("");
  const [debtorName, setDebtorName] = useState("");
  const [damage, setDamage] = useState("");
  const [depreciation, setDepreciation] = useState("");
  const [profitLoss, setProfitLoss] = useState("");
  const [discount, setDiscount] = useState("");
  const [enforcementOffice, setEnforcementOffice] = useState("");
  const [enforcementFileNumber, setEnforcementFileNumber] = useState("");
  const [vehicleLien, setVehicleLien] = useState(false);
  const [bankLien, setBankLien] = useState(false);
  const [titleDeedLien, setTitleDeedLien] = useState(false);
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentCount, setInstallmentCount] = useState<InstallmentCount>(3);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [reminder, setReminder] = useState<ReminderDraft | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [reminderDraft, setReminderDraft] = useState<ReminderDraft>(emptyReminder);
  const [operation, setOperation] = useState<Operation>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const financials = useMemo(() => {
    const total = toCents(damage) + toCents(depreciation) + toCents(profitLoss);
    const net = total > toCents(discount) ? total - toCents(discount) : 0n;
    const monthly = installmentEnabled ? divideCents(net, BigInt(installmentCount)) : 0n;
    const remainder = installmentEnabled ? net % BigInt(installmentCount) : 0n;

    return {
      total: centsToInput(total),
      net: centsToInput(net),
      monthly: centsToInput(monthly),
      final: centsToInput(monthly + remainder),
    };
  }, [damage, depreciation, profitLoss, discount, installmentEnabled, installmentCount]);

  function openNote() {
    setNoteDraft(note);
    setOperation("note");
  }

  function openReminder() {
    setReminderDraft(reminder ?? emptyReminder);
    setOperation("reminder");
  }

  function changeInstallment(enabled: boolean) {
    setInstallmentEnabled(enabled);
    if (!enabled) setInstallmentCount(3);
  }

  function changeStatus(nextStatus: string) {
    setStatus(nextStatus);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseHolder,
          vehiclePlate,
          accidentDate,
          debtorType,
          debtorName: debtorName || null,
          damageAmount: normalizeMoney(damage),
          depreciationAmount: normalizeMoney(depreciation),
          profitLossAmount: normalizeMoney(profitLoss),
          discountAmount: normalizeMoney(discount),
          enforcementOffice: enforcementOffice || null,
          enforcementFileNumber: enforcementFileNumber || null,
          vehicleLien,
          bankLien,
          titleDeedLien,
          installmentCount: installmentEnabled ? installmentCount : null,
          status,
          note: note || null,
          reminder: reminder ? {
            ...reminder,
            dueAt: new Date(reminder.dueAt).toISOString(),
          } : null,
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

      let documentFailed = false;
      if (documentFile) {
        const documentBody = new FormData();
        documentBody.set("file", documentFile);
        documentBody.set("documentName", documentName.trim());
        const documentResponse = await fetch(`/api/cases/${encodeURIComponent(result.data.id)}/documents`, {
          method: "POST",
          credentials: "same-origin",
          body: documentBody,
        });
        documentFailed = !documentResponse.ok;
      }

      setNotice({ tone: "success", message: `${result.data.referenceNumber} numaralı dosya oluşturuldu.` });
      router.push(`/dosyalarim?created=${encodeURIComponent(result.data.referenceNumber)}${documentFailed ? "&document=failed" : ""}`);
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

  return <AppShell hideTopbar>
    <form className={styles.newCasePage} onSubmit={handleSubmit} noValidate={false}>
      <header className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <h1>Yeni Dosya Ekle</h1>
          <p><Link href="/dashboard">Ana Sayfa</Link><span>›</span><Link href="/dosyalarim">Dosyalarım</Link><span>›</span><b>Yeni Dosya Ekle</b></p>
        </div>
        <p className={styles.pageDescription}>Dosya bilgilerini eksiksiz girerek kaydediniz.</p>
        <div className={styles.pageActions}>
          <Link href="/dosyalarim"><Icon name="x" />Vazgeç</Link>
          <button type="submit" disabled={isSubmitting}><Icon name="check" />{isSubmitting ? "Kaydediliyor..." : "Kaydet"}</button>
        </div>
      </header>

      {notice && <p className={`${styles.notice} ${notice.tone === "error" ? styles.noticeError : ""}`} role={notice.tone === "error" ? "alert" : "status"}>
        {notice.message}
        <button type="button" aria-label="Bildirimi kapat" onClick={() => setNotice(null)}><Icon name="x" /></button>
      </p>}

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
        <h2><span>2</span>Hesaplanan Tutarlar</h2>
        <div className={styles.fourColumns}>
          <AmountInput label="Hesaplanan Hasar Bedeli Tutarı" value={damage} onChange={setDamage} error={fieldErrors.damageAmount?.[0]} />
          <AmountInput label="Hesaplanan Değer Kaybı Tutarı" value={depreciation} onChange={setDepreciation} error={fieldErrors.depreciationAmount?.[0]} />
          <AmountInput label="Hesaplanan Kazanç Kaybı Tutarı" value={profitLoss} onChange={setProfitLoss} error={fieldErrors.profitLossAmount?.[0]} />
          <AmountInput label="Talep Edilen Toplam Tutar" value={financials.total} readOnly />
        </div>
      </section>

      <div className={styles.splitGrid}>
        <section className={styles.sectionCard}>
          <h2><span>3</span>İcra Bilgileri</h2>
          <div className={styles.threeColumns}>
            <label className={styles.field}><span>İcra Dairesi</span><input maxLength={150} value={enforcementOffice} onChange={(event) => setEnforcementOffice(event.target.value)} placeholder="İstanbul 12. İcra Dairesi" /><FieldError errors={fieldErrors} name="enforcementOffice" /></label>
            <label className={styles.field}><span>İcra Dosya Numarası</span><input maxLength={50} value={enforcementFileNumber} onChange={(event) => setEnforcementFileNumber(event.target.value)} placeholder="2026/12345" /><FieldError errors={fieldErrors} name="enforcementFileNumber" /></label>
            <AmountInput label="Toplam Dosya Hesabı" value={financials.total} readOnly />
          </div>
        </section>
        <section className={styles.sectionCard}>
          <h2><span>4</span>Finansal Bilgiler</h2>
          <div className={styles.twoColumns}>
            <AmountInput label="İndirim Tutarı" value={discount} onChange={setDiscount} error={fieldErrors.discountAmount?.[0]} />
            <AmountInput label="Net Talep Tutarı" value={financials.net} readOnly />
          </div>
        </section>
      </div>

      <div className={styles.splitGrid}>
        <section className={styles.sectionCard}>
          <h2><span>5</span>Haciz Bilgileri</h2>
          <div className={styles.toggleGrid}>
            <Toggle label="Araç Haczi" checked={vehicleLien} onChange={setVehicleLien} />
            <Toggle label="Banka Haczi" checked={bankLien} onChange={setBankLien} />
            <Toggle label="Tapu Haczi" checked={titleDeedLien} onChange={setTitleDeedLien} />
          </div>
        </section>
        <section className={styles.sectionCard}>
          <h2><span>6</span>Taksit Bilgileri</h2>
          <div className={styles.threeColumns}>
            <label className={styles.field}><span>Taksit Var mı?</span><select value={installmentEnabled ? "yes" : "no"} onChange={(event) => changeInstallment(event.target.value === "yes")}><option value="no">Hayır</option><option value="yes">Evet</option></select></label>
            {installmentEnabled && <>
              <label className={styles.field}><span>Taksit Sayısı</span><select value={installmentCount} onChange={(event) => setInstallmentCount(Number(event.target.value) as InstallmentCount)}>{INSTALLMENT_OPTIONS.map((count) => <option value={count} key={count}>{count} Ay</option>)}</select><FieldError errors={fieldErrors} name="installmentCount" /></label>
              <AmountInput label="Aylık Taksit Tutarı" value={financials.monthly} readOnly />
            </>}
          </div>
        </section>
      </div>

      <div className={styles.splitGrid}>
        <section className={styles.sectionCard}>
          <h2><span>7</span>Dosya Durumu</h2>
          <label className={styles.field}><span>Dosya Durumu</span><select required value={status} onChange={(event) => changeStatus(event.target.value)}><option value="" disabled>Dosya durumunu seçiniz</option><option value="OPEN">Devam Ediyor</option><option value="ENFORCEMENT">İcra Takibinde</option><option value="INSTALLMENT">Taksitli Ödeme</option><option value="PENDING">Beklemede</option><option value="CLOSED">Sonuçlandı</option></select><FieldError errors={fieldErrors} name="status" /></label>
          <p className={styles.hint}>Dosya durumunu doğru seçmek, süreç takibi açısından önemlidir.</p>
        </section>
        <section className={styles.sectionCard}>
          <h2><span>8</span>Dosya İşlemleri</h2>
          <div className={styles.operationGrid}>
            <button type="button" className={note ? styles.operationAdded : ""} onClick={openNote}><Icon name="note" /><span>{note ? "Not Eklendi" : "Not Ekle"}</span></button>
            <button type="button" className={documentFile ? styles.operationAdded : ""} onClick={() => setOperation("document")}><Icon name="document" /><span>{documentFile ? "Evrak Eklendi" : "Evrak Ekle"}</span></button>
            <button type="button" className={reminder ? styles.operationAdded : ""} onClick={openReminder}><Icon name="bell" /><span>{reminder ? "Hatırlatma Eklendi" : "Hatırlatma Ekle"}</span></button>
          </div>
          <FieldError errors={fieldErrors} name="reminder" />
          <FieldError errors={fieldErrors} name="note" />
        </section>
      </div>
    </form>

    {operation && <div className={styles.modalBackdrop} onMouseDown={() => setOperation(null)}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="operation-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><h2 id="operation-title">{operation === "note" ? "Not Ekle" : operation === "reminder" ? "Hatırlatma Ekle" : "Evrak Ekle"}</h2><button type="button" aria-label="Pencereyi kapat" onClick={() => setOperation(null)}><Icon name="x" /></button></header>
        <div className={styles.modalBody}>
          {operation === "note" && <label className={styles.field}><span>Dosya Notu</span><textarea maxLength={2_000} rows={6} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Dosyayla ilgili notunuzu yazın..." /></label>}
          {operation === "document" && <>
            <label className={styles.field}><span>PDF, JPG veya PNG · En fazla 20 MB</span><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setDocumentFile(file);
              if (file) setDocumentName(file.name.replace(/\.[^.]+$/, ""));
            }} /></label>
            <label className={styles.field}><span>Evrak Adı</span><div className={styles.documentNameInput}><input required disabled={!documentFile} maxLength={240} value={documentName} onChange={(event) => setDocumentName(event.target.value)} placeholder={documentFile ? "Evrak adını yazın" : "Önce evrak seçin"} />{documentFile && <b>.{documentExtension(documentFile)}</b>}</div></label>
          </>}
          {operation === "reminder" && <>
            <small>Belirlediğiniz tarih ve saatte aktif, e-postası doğrulanmış yöneticilere e-posta gönderilir.</small>
            <label className={styles.field}><span>Hatırlatma Başlığı</span><input required maxLength={500} value={reminderDraft.title} onChange={(event) => setReminderDraft({ ...reminderDraft, title: event.target.value })} placeholder="Örn: Duruşma tarihi" /></label>
            <div className={styles.reminderDateTime}>
              <label className={styles.field}><span>Tarih</span><input required type="date" max="9999-12-31" value={datePart(reminderDraft.dueAt)} onChange={(event) => setReminderDraft({ ...reminderDraft, dueAt: combineDateTime(limitDateYear(event.target.value, datePart(reminderDraft.dueAt)), timePart(reminderDraft.dueAt)) })} /></label>
              <label className={styles.field}><span>Saat</span><input required type="text" inputMode="numeric" maxLength={5} placeholder="SS:DD" value={timePart(reminderDraft.dueAt)} onChange={(event) => setReminderDraft({ ...reminderDraft, dueAt: combineDateTime(datePart(reminderDraft.dueAt), formatTimeInput(event.target.value, timePart(reminderDraft.dueAt))) })} /></label>
            </div>
          </>}
        </div>
        <footer>
          <div className={styles.modalActions}>
            <button type="button" onClick={() => setOperation(null)}>Vazgeç</button>
            <button type="button" onClick={() => {
            if (operation === "note") {
              setNote(noteDraft.trim());
              setOperation(null);
              return;
            }

            if (operation === "document") {
              if (!documentFile || !documentName.trim()) {
                setNotice({ tone: "error", message: "Lütfen yüklenecek evrakı seçin ve evrak adını yazın." });
                return;
              }
              setOperation(null);
              return;
            }

            if (!reminderDraft.title.trim() || !isCompleteDateTime(reminderDraft.dueAt)) {
              setNotice({ tone: "error", message: "Hatırlatma başlığı ve tarihi zorunludur." });
              return;
            }

            setReminder({ ...reminderDraft, title: reminderDraft.title.trim() });
            setOperation(null);
            }}>Forma Ekle</button>
          </div>
        </footer>
      </section>
    </div>}
  </AppShell>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={styles.toggle}><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /><small>{checked ? "Evet" : "Hayır"}</small></label>;
}

function normalizeMoney(value: string): string {
  return value.trim() || "0";
}

function toCents(value: string): bigint {
  return parseMoneyToCents(value) ?? 0n;
}

function divideCents(value: bigint, divisor: bigint): bigint {
  return (value + divisor / 2n) / divisor;
}

function centsToInput(value: bigint): string {
  return centsToMoneyString(value);
}

function datePart(value: string): string {
  return value.split("T")[0] ?? "";
}

function timePart(value: string): string {
  return value.includes("T") ? (value.split("T")[1] ?? "") : "";
}

function combineDateTime(date: string, time: string): string {
  return date || time ? `${date}T${time}` : "";
}

function isCompleteDateTime(value: string): boolean {
  const [date, time = ""] = value.split("T");
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && isValidTime(time);
}

function documentExtension(file: File): string {
  return file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
}

function todayDate(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}
