"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { centsToMoneyString, formatMoneyInput, formatTimeInput, isValidTime, limitDateYear, parseMoneyToCents } from "@/lib/form-input";
import { INSTALLMENT_OPTIONS } from "@/lib/form-input";
import type { InstallmentCount } from "@/lib/cases/create-case-input";
import styles from "./page.module.css";

type CaseStatus = "OPEN" | "ENFORCEMENT" | "INSTALLMENT" | "PENDING" | "CLOSED";
type DebtorType = "INSURANCE_COMPANY" | "INDIVIDUAL" | "COMPANY";
type FieldErrors = Record<string, string[] | undefined>;

type CaseDetail = {
  id: string;
  referenceNumber: string;
  licenseHolder: string;
  vehiclePlate: string;
  accidentDate: string;
  debtorType: DebtorType;
  debtorName: string | null;
  damageAmount: string;
  depreciationAmount: string;
  profitLossAmount: string;
  discountAmount: string;
  totalClaimAmount: string;
  netClaimAmount: string;
  monthlyInstallmentAmount: string | null;
  finalInstallmentAmount: string | null;
  enforcementOffice: string | null;
  enforcementFileNumber: string | null;
  vehicleLien: boolean;
  bankLien: boolean;
  titleDeedLien: boolean;
  installmentCount: InstallmentCount | null;
  status: CaseStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: { name: string };
  updatedBy: { name: string };
  notes: Array<{ id: string; content: string; createdAt: string; author: { name: string } }>;
  reminders: Array<{ id: string; title: string; dueAt: string; sendEmail: boolean; sendSms: boolean; status: string }>;
  documents: Array<{ id: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: string }>;
  changes: Array<{ id: string; changeType: string; newVersion: number; changedFields: unknown; createdAt: string; changedBy: { name: string } }>;
};

type Draft = Pick<CaseDetail,
  "licenseHolder" | "vehiclePlate" | "accidentDate" | "debtorType" | "debtorName" |
  "damageAmount" | "depreciationAmount" | "profitLossAmount" | "discountAmount" |
  "enforcementOffice" | "enforcementFileNumber" | "vehicleLien" | "bankLien" |
  "titleDeedLien" | "installmentCount" | "status" | "version"
>;

const statusLabels: Record<CaseStatus, string> = {
  OPEN: "Devam Ediyor", ENFORCEMENT: "İcra Takibinde", INSTALLMENT: "Taksitli Ödeme",
  PENDING: "Beklemede", CLOSED: "Sonuçlandı",
};

const fieldLabels: Record<string, string> = {
  referenceNumber: "Dosya numarası",
  licenseHolder: "Ruhsat sahibi", vehiclePlate: "Araç plakası", accidentDate: "Kaza tarihi",
  debtorType: "Borçlu türü", debtorName: "Borçlu taraf", damageAmount: "Hasar bedeli",
  depreciationAmount: "Değer kaybı", profitLossAmount: "Kazanç kaybı", discountAmount: "İndirim",
  enforcementOffice: "İcra dairesi", enforcementFileNumber: "İcra dosya numarası",
  vehicleLien: "Araç haczi", bankLien: "Banka haczi", titleDeedLien: "Tapu haczi",
  installmentCount: "Taksit bilgisi", status: "Dosya durumu",
  totalClaimAmount: "Toplam talep", netClaimAmount: "Net talep",
  monthlyInstallmentAmount: "Aylık taksit", finalInstallmentAmount: "Son taksit",
  hasNote: "Not", hasReminder: "Hatırlatma",
};

export default function CaseDetailModal({ caseId, initialMode, onClose, onSaved }: {
  caseId: string;
  initialMode: "view" | "edit" | "reminder";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(initialMode === "edit");
  const [reminderOpen, setReminderOpen] = useState(initialMode === "reminder");
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDueAt, setReminderDueAt] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [activitySaving, setActivitySaving] = useState(false);
  const [editActivity, setEditActivity] = useState<"note" | "document" | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editDocument, setEditDocument] = useState<File | null>(null);
  const [editDocumentName, setEditDocumentName] = useState("");
  const [editActivitySaving, setEditActivitySaving] = useState(false);
  const [editActivityNotice, setEditActivityNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const loadDetail = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}`, { credentials: "same-origin", cache: "no-store", signal });
      const result = await response.json() as { data?: CaseDetail; error?: { message?: string } };
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? "Dosya ayrıntıları yüklenemedi.");
      setDetail(result.data);
      setDraft(toDraft(result.data));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Dosya ayrıntıları yüklenemedi.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/cases/${encodeURIComponent(caseId)}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json() as { data?: CaseDetail; error?: { message?: string } };
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? "Dosya ayrıntıları yüklenemedi.");
      return result.data;
    }).then((record) => {
      setDetail(record);
      setDraft(toDraft(record));
    }).catch((loadError: unknown) => {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Dosya ayrıntıları yüklenemedi.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [caseId]);

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setError("");
    setFieldErrors({});

    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          debtorName: draft.debtorName || null,
          enforcementOffice: draft.enforcementOffice || null,
          enforcementFileNumber: draft.enforcementFileNumber || null,
          damageAmount: normalizeMoney(draft.damageAmount),
          depreciationAmount: normalizeMoney(draft.depreciationAmount),
          profitLossAmount: normalizeMoney(draft.profitLossAmount),
          discountAmount: normalizeMoney(draft.discountAmount),
          installmentCount: draft.installmentCount,
        }),
      });
      const result = await response.json() as { data?: { version: number }; error?: { message?: string; fields?: FieldErrors; code?: string } };

      if (!response.ok || !result.data) {
        setFieldErrors(result.error?.fields ?? {});
        setError(result.error?.message ?? "Dosya güncellenemedi.");
        if (result.error?.code === "VERSION_CONFLICT") await loadDetail();
        return;
      }

      await loadDetail();
      setEditing(false);
      onSaved();
    } catch {
      setError("Sunucuya ulaşılamadı. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  async function saveReminder(event: FormEvent) {
    event.preventDefault();
    if (!isCompleteDateTime(reminderDueAt) || activitySaving) return;
    setActivitySaving(true);
    setError("");
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/reminders`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reminderTitle,
          dueAt: new Date(reminderDueAt).toISOString(),
          sendEmail,
          sendSms,
        }),
      });
      const result = await response.json() as { data?: { id: string }; error?: { message?: string } };
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? "Bilgi eklenemedi.");
      setReminderTitle("");
      setReminderDueAt("");
      setReminderOpen(false);
      await loadDetail();
      onSaved();
    } catch (activityError) {
      setError(activityError instanceof Error ? activityError.message : "Bilgi eklenemedi.");
    } finally {
      setActivitySaving(false);
    }
  }

  async function addNoteFromEdit() {
    const content = editNote.trim();
    if (!content || editActivitySaving) return;
    setEditActivitySaving(true);
    setError("");
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/notes`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const result = await response.json() as { data?: { id: string }; error?: { message?: string } };
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? "Not eklenemedi.");
      setEditNote("");
      setEditActivity(null);
      setEditActivityNotice("Not dosyaya eklendi.");
      const preservedDraft = draft;
      await loadDetail();
      if (preservedDraft) setDraft(preservedDraft);
      onSaved();
    } catch (activityError) {
      setError(activityError instanceof Error ? activityError.message : "Not eklenemedi.");
    } finally {
      setEditActivitySaving(false);
    }
  }

  async function addDocumentFromEdit() {
    if (!editDocument || !editDocumentName.trim() || editActivitySaving) return;
    setEditActivitySaving(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", editDocument);
      body.set("documentName", editDocumentName.trim());
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/documents`, {
        method: "POST",
        credentials: "same-origin",
        body,
      });
      const result = await response.json() as { data?: { id: string }; error?: { message?: string } };
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? "Evrak eklenemedi.");
      setEditDocument(null);
      setEditDocumentName("");
      setEditActivity(null);
      setEditActivityNotice("Evrak dosyaya eklendi.");
      const preservedDraft = draft;
      await loadDetail();
      if (preservedDraft) setDraft(preservedDraft);
      onSaved();
    } catch (activityError) {
      setError(activityError instanceof Error ? activityError.message : "Evrak eklenemedi.");
    } finally {
      setEditActivitySaving(false);
    }
  }

  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}>
    <section className={`${styles.detailModal} ${styles.fullDetailModal}`} role="dialog" aria-modal="true" aria-labelledby="detail-title" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><p>{detail?.referenceNumber ?? "Dosya ayrıntısı"}</p><h2 id="detail-title">{detail?.vehiclePlate ?? "Yükleniyor…"}</h2></div>
        <button type="button" aria-label="Detay penceresini kapat" onClick={onClose}>×</button>
      </header>

      {loading && <p className={styles.modalMessage}>Dosya ayrıntıları yükleniyor…</p>}
      {error && <p className={`${styles.modalMessage} ${styles.modalError}`} role="alert">{error}</p>}

      {!loading && detail && draft && (editing ? <form className={styles.editForm} onSubmit={save}>
        <div className={styles.editGrid}>
          <TextField label="Ruhsat Sahibi" maxLength={150} value={draft.licenseHolder} error={fieldErrors.licenseHolder?.[0]} onChange={(value) => update("licenseHolder", value)} />
          <TextField label="Araç Plakası" maxLength={20} value={draft.vehiclePlate} error={fieldErrors.vehiclePlate?.[0]} onChange={(value) => update("vehiclePlate", value.toLocaleUpperCase("tr-TR"))} />
          <TextField label="Kaza Tarihi" type="date" value={draft.accidentDate} error={fieldErrors.accidentDate?.[0]} onChange={(value) => update("accidentDate", value)} />
          <label><span>Borçlu Türü</span><select value={draft.debtorType} onChange={(event) => update("debtorType", event.target.value as DebtorType)}><option value="INSURANCE_COMPANY">Sigorta Şirketi</option><option value="INDIVIDUAL">Şahıs</option><option value="COMPANY">Şirket</option></select></label>
          <TextField label="Borçlu Taraf" maxLength={150} value={draft.debtorName ?? ""} error={fieldErrors.debtorName?.[0]} onChange={(value) => update("debtorName", value)} />
          <MoneyField label="Hasar Bedeli" value={draft.damageAmount} error={fieldErrors.damageAmount?.[0]} onChange={(value) => update("damageAmount", value)} />
          <MoneyField label="Değer Kaybı" value={draft.depreciationAmount} error={fieldErrors.depreciationAmount?.[0]} onChange={(value) => update("depreciationAmount", value)} />
          <MoneyField label="Kazanç Kaybı" value={draft.profitLossAmount} error={fieldErrors.profitLossAmount?.[0]} onChange={(value) => update("profitLossAmount", value)} />
          <MoneyField label="İndirim" value={draft.discountAmount} error={fieldErrors.discountAmount?.[0]} onChange={(value) => update("discountAmount", value)} />
          <TextField label="İcra Dairesi" maxLength={150} value={draft.enforcementOffice ?? ""} error={fieldErrors.enforcementOffice?.[0]} onChange={(value) => update("enforcementOffice", value)} />
          <TextField label="İcra Dosya No" maxLength={50} value={draft.enforcementFileNumber ?? ""} error={fieldErrors.enforcementFileNumber?.[0]} onChange={(value) => update("enforcementFileNumber", value)} />
          <label><span>Dosya Durumu</span><select value={draft.status} onChange={(event) => update("status", event.target.value as CaseStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Taksit Var mı?</span><select value={draft.installmentCount === null ? "no" : "yes"} onChange={(event) => update("installmentCount", event.target.value === "yes" ? draft.installmentCount ?? 3 : null)}><option value="no">Hayır</option><option value="yes">Evet</option></select></label>
          {draft.installmentCount !== null && <label><span>Taksit Sayısı</span><select value={draft.installmentCount} onChange={(event) => update("installmentCount", Number(event.target.value) as InstallmentCount)}>{INSTALLMENT_OPTIONS.map((count) => <option value={count} key={count}>{count} Ay</option>)}</select></label>}
          {draft.installmentCount !== null && <InstallmentPreview draft={draft} />}
        </div>
        <div className={styles.editLienSection}>
          <span>Haciz Durumu</span>
          <div className={styles.editChecks}>
            <label><input type="checkbox" checked={draft.vehicleLien} onChange={(event) => update("vehicleLien", event.target.checked)} /> Araç haczi</label>
            <label><input type="checkbox" checked={draft.bankLien} onChange={(event) => update("bankLien", event.target.checked)} /> Banka haczi</label>
            <label><input type="checkbox" checked={draft.titleDeedLien} onChange={(event) => update("titleDeedLien", event.target.checked)} /> Tapu haczi</label>
          </div>
        </div>
        <section className={styles.editOperationSection}>
          <div className={styles.editOperationHeading}><span><b>Dosya İşlemleri</b><small>Dosya bilgilerini değiştirmeden not veya evrak ekleyin.</small></span></div>
          <div className={styles.editOperationGrid}>
            <button type="button" onClick={() => { setEditActivity("note"); setEditActivityNotice(""); }}><EditActivityIcon name="note" /><span>Not Ekle</span></button>
            <button type="button" onClick={() => { setEditActivity("document"); setEditActivityNotice(""); }}><EditActivityIcon name="document" /><span>Evrak Ekle</span></button>
          </div>
          {editActivityNotice && <p className={styles.editOperationNotice} role="status">{editActivityNotice}</p>}
        </section>
        {editActivity && <div className={styles.editActivityBackdrop} role="presentation" onMouseDown={() => { if (!editActivitySaving) setEditActivity(null); }}>
          <section className={styles.editActivityModal} role="dialog" aria-modal="true" aria-labelledby="edit-activity-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><h3 id="edit-activity-title">{editActivity === "note" ? "Not Ekle" : "Evrak Ekle"}</h3><button type="button" aria-label="Pencereyi kapat" disabled={editActivitySaving} onClick={() => setEditActivity(null)}>×</button></header>
            <div className={styles.editActivityBody}>
              {editActivity === "note" && <label><span>Dosya Notu</span><textarea rows={6} maxLength={2_000} value={editNote} onChange={(event) => setEditNote(event.target.value)} placeholder="Dosyayla ilgili notunuzu yazın..." /></label>}
              {editActivity === "document" && <>
                <label><span>PDF, JPG veya PNG · En fazla 20 MB</span><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => { const file = event.target.files?.[0] ?? null; setEditDocument(file); if (file) setEditDocumentName(file.name.replace(/\.[^.]+$/, "")); }} /></label>
                <label><span>Evrak Adı</span><div className={styles.editDocumentName}><input disabled={!editDocument} maxLength={240} value={editDocumentName} onChange={(event) => setEditDocumentName(event.target.value)} placeholder={editDocument ? "Evrak adını yazın" : "Önce evrak seçin"} />{editDocument && <b>.{documentExtension(editDocument)}</b>}</div></label>
              </>}
            </div>
            <footer>
              <button type="button" disabled={editActivitySaving} onClick={() => setEditActivity(null)}>Vazgeç</button>
              <button type="button" disabled={editActivity === "note" ? !editNote.trim() || editActivitySaving : !editDocument || !editDocumentName.trim() || editActivitySaving} onClick={() => void (editActivity === "note" ? addNoteFromEdit() : addDocumentFromEdit())}>{editActivitySaving ? "Ekleniyor…" : editActivity === "note" ? "Notu Ekle" : "Evrakı Ekle"}</button>
            </footer>
          </section>
        </div>}
        <footer><button type="button" onClick={() => { setDraft(toDraft(detail)); setEditing(false); setError(""); }}>Vazgeç</button><button type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}</button></footer>
      </form> : <>
        <div className={styles.detailScroll}>
          {reminderOpen && <form className={styles.activityForm} onSubmit={saveReminder}>
            <div><h3>Yeni Hatırlatma</h3><button type="button" aria-label="Hatırlatma formunu kapat" onClick={() => setReminderOpen(false)}>×</button></div>
            <label className={styles.activityField}><span>Hatırlatma başlığı</span><input required maxLength={500} value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder="Örn: Duruşma hazırlığı" /></label>
            <div className={styles.activityDateTime}>
              <label className={styles.activityField}><span>Tarih</span><input required type="date" max="9999-12-31" value={datePart(reminderDueAt)} onChange={(event) => setReminderDueAt(combineDateTime(limitDateYear(event.target.value, datePart(reminderDueAt)), timePart(reminderDueAt)))} /></label>
              <label className={styles.activityField}><span>Saat</span><input required type="text" inputMode="numeric" maxLength={5} placeholder="SS:DD" value={timePart(reminderDueAt)} onChange={(event) => setReminderDueAt(combineDateTime(datePart(reminderDueAt), formatTimeInput(event.target.value, timePart(reminderDueAt))))} /></label>
            </div>
            <div className={styles.activityActions}>
              <p><label><input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} /> E-posta</label><label><input type="checkbox" checked={sendSms} onChange={(event) => setSendSms(event.target.checked)} /> SMS</label></p>
              <button type="submit" disabled={activitySaving}>{activitySaving ? "Ekleniyor…" : "Kaydet"}</button>
            </div>
          </form>}
          <dl>
            <Detail label="Ruhsat Sahibi" value={detail.licenseHolder} /><Detail label="Borçlu Taraf" value={detail.debtorName ?? "—"} />
            <Detail label="Kaza Tarihi" value={formatDate(detail.accidentDate)} /><Detail label="Dosya Durumu" value={statusLabels[detail.status]} />
            <Detail label="Toplam Talep" value={`${formatMoney(detail.totalClaimAmount)} TL`} /><Detail label="Net Talep" value={`${formatMoney(detail.netClaimAmount)} TL`} />
            <Detail label="Taksit Bilgisi" value={detail.installmentCount ? `${detail.installmentCount} ay · ${formatMoney(detail.monthlyInstallmentAmount ?? "0")} TL/ay` : "Taksit yok"} />
            <Detail label="İcra Dairesi / No" value={[detail.enforcementOffice, detail.enforcementFileNumber].filter(Boolean).join(" · ") || "—"} />
            <Detail label="Hacizler" value={[detail.vehicleLien && "Araç", detail.bankLien && "Banka", detail.titleDeedLien && "Tapu"].filter(Boolean).join(", ") || "Yok"} />
            <Detail label="Oluşturan" value={`${detail.createdBy.name} · ${formatDateTime(detail.createdAt)}`} />
            <Detail label="Son Güncelleyen" value={`${detail.updatedBy.name} · ${formatDateTime(detail.updatedAt)}`} />
          </dl>
          <section className={`${styles.detailSection} ${styles.historySection}`}><h3>Düzenleme Geçmişi</h3>{detail.changes.map((change) => <article key={change.id}><b>Değişiklik {change.newVersion}</b><span>{change.changedBy.name} · {formatDateTime(change.createdAt)}</span><small>{changedFieldText(change.changedFields)}</small></article>)}</section>
          <section className={styles.detailSection}><h3>Notlar ({detail.notes.length})</h3>{detail.notes.length ? detail.notes.map((note) => <article key={note.id}><b>{note.author.name}</b><span>{formatDateTime(note.createdAt)}</span><small>{note.content}</small></article>) : <p>Henüz not yok.</p>}</section>
          <section className={styles.detailSection}><h3>Hatırlatmalar ({detail.reminders.length})</h3>{detail.reminders.length ? detail.reminders.map((reminder) => <article key={reminder.id}><b>{reminder.title}</b><span>{formatDateTime(reminder.dueAt)} · {reminderStatusLabel(reminder.status)}</span></article>) : <p>Henüz hatırlatma yok.</p>}</section>
          <section className={styles.detailSection}><h3>Evraklar ({detail.documents.length})</h3>{detail.documents.length ? detail.documents.map((document) => <article key={document.id}><a href={`/api/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(document.id)}`}>{document.originalName}</a><span>{formatBytes(document.sizeBytes)} · {formatDateTime(document.createdAt)}</span></article>) : <p>Henüz evrak yok.</p>}</section>
        </div>
      </>)}
    </section>
  </div>;
}

function EditActivityIcon({ name }: { name: "note" | "document" }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{name === "note" ? <><path d="M4 4h12v16H4Z" /><path d="m14 4 4 4M8 9h5M8 13h5" /></> : <><path d="M6 3h9l3 3v15H6Z" /><path d="M14 3v4h4M9 12h6M9 16h4" /></>}</svg>;
}

function TextField({ label, value, onChange, error, type = "text", maxLength }: { label: string; value: string; onChange: (value: string) => void; error?: string; type?: string; maxLength?: number }) {
  return <label><span>{label}</span><input required={label !== "İcra Dairesi" && label !== "İcra Dosya No"} max={type === "date" ? "9999-12-31" : undefined} maxLength={maxLength} type={type} value={value} onChange={(event) => onChange(type === "date" ? limitDateYear(event.target.value, value) : event.target.value)} />{error && <small>{error}</small>}</label>;
}
function MoneyField({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  return <label><span>{label}</span><div className={`${styles.editMoneyInput} ${error ? styles.editMoneyInvalid : ""}`}><input required inputMode="decimal" value={value} onChange={(event) => onChange(formatMoneyInput(event.target.value))} onBlur={() => {
    const cents = parseMoneyToCents(value);
    if (cents !== null) onChange(centsToMoneyString(cents));
  }} /><b>TL</b></div>{error && <small>{error}</small>}</label>;
}
function InstallmentPreview({ draft }: { draft: Draft }) {
  const installment = calculateDraftInstallment(draft);
  return <label><span>Aylık Taksit</span><div className={styles.editMoneyInput}><input readOnly value={formatMoney(installment.monthly)} /><b>TL</b></div></label>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function toDraft(detail: CaseDetail): Draft { return { licenseHolder: detail.licenseHolder, vehiclePlate: detail.vehiclePlate, accidentDate: detail.accidentDate, debtorType: detail.debtorType, debtorName: detail.debtorName, damageAmount: formatMoney(detail.damageAmount), depreciationAmount: formatMoney(detail.depreciationAmount), profitLossAmount: formatMoney(detail.profitLossAmount), discountAmount: formatMoney(detail.discountAmount), enforcementOffice: detail.enforcementOffice, enforcementFileNumber: detail.enforcementFileNumber, vehicleLien: detail.vehicleLien, bankLien: detail.bankLien, titleDeedLien: detail.titleDeedLien, installmentCount: detail.installmentCount, status: detail.status, version: detail.version }; }
function normalizeMoney(value: string) { return value.trim() || "0"; }
function formatMoney(value: string) { const cents = parseMoneyToCents(value); return cents === null ? "0,00" : centsToMoneyString(cents); }
function calculateDraftInstallment(draft: Draft) {
  const total = [draft.damageAmount, draft.depreciationAmount, draft.profitLossAmount].reduce((sum, value) => sum + (parseMoneyToCents(value) ?? 0n), 0n);
  const discount = parseMoneyToCents(draft.discountAmount) ?? 0n;
  const net = total > discount ? total - discount : 0n;
  const count = BigInt(draft.installmentCount ?? 1);
  const monthly = net / count;
  return { monthly: centsToMoneyString(monthly) };
}
function changedFieldText(value: unknown) { return Array.isArray(value) && value.length ? value.map((field) => fieldLabels[String(field)] ?? String(field)).join(", ") : "İlk kayıt"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(value)); }
function formatBytes(value: number) { return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`; }
function documentExtension(file: File) { return file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg"; }
function reminderStatusLabel(value: string) { return ({ PENDING: "Bekliyor", SENT: "Gönderildi", FAILED: "Gönderilemedi" } as Record<string, string>)[value] ?? value; }
function datePart(value: string) { return value.split("T")[0] ?? ""; }
function timePart(value: string) { return value.includes("T") ? (value.split("T")[1] ?? "") : ""; }
function combineDateTime(date: string, time: string) { return date || time ? `${date}T${time}` : ""; }
function isCompleteDateTime(value: string) { const [date, time = ""] = value.split("T"); return /^\d{4}-\d{2}-\d{2}$/.test(date) && isValidTime(time); }
