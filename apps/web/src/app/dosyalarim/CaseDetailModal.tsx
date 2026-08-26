"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

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
  enforcementOffice: string | null;
  enforcementFileNumber: string | null;
  vehicleLien: boolean;
  bankLien: boolean;
  titleDeedLien: boolean;
  installmentCount: 3 | 4 | null;
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
  licenseHolder: "Ruhsat sahibi", vehiclePlate: "Araç plakası", accidentDate: "Kaza tarihi",
  debtorType: "Borçlu türü", debtorName: "Borçlu taraf", damageAmount: "Hasar bedeli",
  depreciationAmount: "Değer kaybı", profitLossAmount: "Kazanç kaybı", discountAmount: "İndirim",
  enforcementOffice: "İcra dairesi", enforcementFileNumber: "İcra dosya numarası",
  vehicleLien: "Araç haczi", bankLien: "Banka haczi", titleDeedLien: "Tapu haczi",
  installmentCount: "Taksit sayısı", status: "Dosya durumu",
};

export default function CaseDetailModal({ caseId, startEditing, onClose, onSaved }: {
  caseId: string;
  startEditing: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(startEditing);
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
          installmentCount: draft.status === "INSTALLMENT" ? draft.installmentCount ?? 3 : null,
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
          <TextField label="Ruhsat Sahibi" value={draft.licenseHolder} error={fieldErrors.licenseHolder?.[0]} onChange={(value) => update("licenseHolder", value)} />
          <TextField label="Araç Plakası" value={draft.vehiclePlate} error={fieldErrors.vehiclePlate?.[0]} onChange={(value) => update("vehiclePlate", value)} />
          <TextField label="Kaza Tarihi" type="date" value={draft.accidentDate} error={fieldErrors.accidentDate?.[0]} onChange={(value) => update("accidentDate", value)} />
          <label><span>Borçlu Türü</span><select value={draft.debtorType} onChange={(event) => update("debtorType", event.target.value as DebtorType)}><option value="INSURANCE_COMPANY">Sigorta Şirketi</option><option value="INDIVIDUAL">Şahıs</option><option value="COMPANY">Şirket</option></select></label>
          <TextField label="Borçlu Taraf" value={draft.debtorName ?? ""} error={fieldErrors.debtorName?.[0]} onChange={(value) => update("debtorName", value)} />
          <TextField label="Hasar Bedeli (TL)" value={draft.damageAmount} error={fieldErrors.damageAmount?.[0]} onChange={(value) => update("damageAmount", value)} />
          <TextField label="Değer Kaybı (TL)" value={draft.depreciationAmount} error={fieldErrors.depreciationAmount?.[0]} onChange={(value) => update("depreciationAmount", value)} />
          <TextField label="Kazanç Kaybı (TL)" value={draft.profitLossAmount} error={fieldErrors.profitLossAmount?.[0]} onChange={(value) => update("profitLossAmount", value)} />
          <TextField label="İndirim (TL)" value={draft.discountAmount} error={fieldErrors.discountAmount?.[0]} onChange={(value) => update("discountAmount", value)} />
          <TextField label="İcra Dairesi" value={draft.enforcementOffice ?? ""} error={fieldErrors.enforcementOffice?.[0]} onChange={(value) => update("enforcementOffice", value)} />
          <TextField label="İcra Dosya No" value={draft.enforcementFileNumber ?? ""} error={fieldErrors.enforcementFileNumber?.[0]} onChange={(value) => update("enforcementFileNumber", value)} />
          <label><span>Dosya Durumu</span><select value={draft.status} onChange={(event) => update("status", event.target.value as CaseStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {draft.status === "INSTALLMENT" && <label><span>Taksit Sayısı</span><select value={draft.installmentCount ?? 3} onChange={(event) => update("installmentCount", Number(event.target.value) as 3 | 4)}><option value="3">3 Ay</option><option value="4">4 Ay</option></select></label>}
        </div>
        <div className={styles.editChecks}>
          <label><input type="checkbox" checked={draft.vehicleLien} onChange={(event) => update("vehicleLien", event.target.checked)} /> Araç haczi</label>
          <label><input type="checkbox" checked={draft.bankLien} onChange={(event) => update("bankLien", event.target.checked)} /> Banka haczi</label>
          <label><input type="checkbox" checked={draft.titleDeedLien} onChange={(event) => update("titleDeedLien", event.target.checked)} /> Tapu haczi</label>
        </div>
        <footer><button type="button" onClick={() => { setDraft(toDraft(detail)); setEditing(false); setError(""); }}>Vazgeç</button><button type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}</button></footer>
      </form> : <>
        <div className={styles.detailScroll}>
          <dl>
            <Detail label="Ruhsat Sahibi" value={detail.licenseHolder} /><Detail label="Borçlu Taraf" value={detail.debtorName ?? "—"} />
            <Detail label="Kaza Tarihi" value={formatDate(detail.accidentDate)} /><Detail label="Dosya Durumu" value={statusLabels[detail.status]} />
            <Detail label="Toplam Talep" value={`${detail.totalClaimAmount} TL`} /><Detail label="Net Talep" value={`${detail.netClaimAmount} TL`} />
            <Detail label="İcra Dairesi / No" value={[detail.enforcementOffice, detail.enforcementFileNumber].filter(Boolean).join(" · ") || "—"} />
            <Detail label="Hacizler" value={[detail.vehicleLien && "Araç", detail.bankLien && "Banka", detail.titleDeedLien && "Tapu"].filter(Boolean).join(", ") || "Yok"} />
            <Detail label="Oluşturan" value={`${detail.createdBy.name} · ${formatDateTime(detail.createdAt)}`} />
            <Detail label="Son Güncelleyen" value={`${detail.updatedBy.name} · ${formatDateTime(detail.updatedAt)}`} />
          </dl>
          <section className={styles.detailSection}><h3>Düzenleme Geçmişi</h3>{detail.changes.map((change) => <article key={change.id}><b>Sürüm {change.newVersion}</b><span>{change.changedBy.name} · {formatDateTime(change.createdAt)}</span><small>{changedFieldText(change.changedFields)}</small></article>)}</section>
          <section className={styles.detailSection}><h3>Notlar ({detail.notes.length})</h3>{detail.notes.length ? detail.notes.map((note) => <article key={note.id}><b>{note.author.name}</b><span>{formatDateTime(note.createdAt)}</span><small>{note.content}</small></article>) : <p>Henüz not yok.</p>}</section>
          <section className={styles.detailSection}><h3>Hatırlatmalar ({detail.reminders.length})</h3>{detail.reminders.length ? detail.reminders.map((reminder) => <article key={reminder.id}><b>{reminder.title}</b><span>{formatDateTime(reminder.dueAt)} · {reminder.status}</span></article>) : <p>Henüz hatırlatma yok.</p>}</section>
          <section className={styles.detailSection}><h3>Evraklar ({detail.documents.length})</h3>{detail.documents.length ? detail.documents.map((document) => <article key={document.id}><b>{document.originalName}</b><span>{formatBytes(document.sizeBytes)} · {formatDateTime(document.createdAt)}</span></article>) : <p>Henüz evrak yok.</p>}</section>
        </div>
        <footer><button type="button" onClick={onClose}>Kapat</button><button type="button" onClick={() => setEditing(true)}>Düzenle</button></footer>
      </>)}
    </section>
  </div>;
}

function TextField({ label, value, onChange, error, type = "text" }: { label: string; value: string; onChange: (value: string) => void; error?: string; type?: string }) {
  return <label><span>{label}</span><input required={label !== "İcra Dairesi" && label !== "İcra Dosya No"} type={type} value={value} onChange={(event) => onChange(event.target.value)} />{error && <small>{error}</small>}</label>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function toDraft(detail: CaseDetail): Draft { return { licenseHolder: detail.licenseHolder, vehiclePlate: detail.vehiclePlate, accidentDate: detail.accidentDate, debtorType: detail.debtorType, debtorName: detail.debtorName, damageAmount: detail.damageAmount, depreciationAmount: detail.depreciationAmount, profitLossAmount: detail.profitLossAmount, discountAmount: detail.discountAmount, enforcementOffice: detail.enforcementOffice, enforcementFileNumber: detail.enforcementFileNumber, vehicleLien: detail.vehicleLien, bankLien: detail.bankLien, titleDeedLien: detail.titleDeedLien, installmentCount: detail.installmentCount, status: detail.status, version: detail.version }; }
function normalizeMoney(value: string) { return value.trim().replace(",", ".") || "0"; }
function changedFieldText(value: unknown) { return Array.isArray(value) && value.length ? value.map((field) => fieldLabels[String(field)] ?? String(field)).join(", ") : "İlk kayıt"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(value)); }
function formatBytes(value: number) { return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`; }
