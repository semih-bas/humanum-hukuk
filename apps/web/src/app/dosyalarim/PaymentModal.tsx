"use client";

import { FormEvent, useEffect, useState } from "react";
import { centsToMoneyString, formatMoneyInput, parseMoneyToCents } from "@/lib/form-input";
import styles from "./PaymentModal.module.css";

type TransactionType = "INCOME" | "EXPENSE";
type Category = keyof typeof categoryLabels;
type TransactionItem = { id: string; type: TransactionType; category: Category; transactionDate: string; amount: string; description: string; documents: Array<{ id: string; originalName: string }> };
type Data = {
  items: TransactionItem[];
  totals: { income: string; expense: string; net: string };
  caseNote: string;
  createdTransactionId?: string;
};

const categoryLabels = {
  PRINCIPAL: "Asıl Alacak",
  PRE_FOLLOW_UP_INTEREST: "Faiz (Takip Öncesi)",
  POST_FOLLOW_UP_INTEREST: "Faiz (Takip Sonrası)",
  ATTORNEY_FEE: "Vekalet Ücreti",
  EXPENSE_REFUND: "Masraf İadesi",
  EXPENSE: "Masraf",
  LITIGATION_EXPENSE: "Yargılama Gideri",
  PENALTY_COMPENSATION: "Cezai Şart / Tazminat",
  OTHER_INCOME: "Diğer Gelir",
  FEE: "Harç",
  NOTIFICATION: "Tebligat",
  EXPERT_FEE: "Bilirkişi Ücreti",
  ATTORNEY_PAYMENT: "Vekalet Ücreti Ödemesi",
  PRISON_FEE: "Cezaevi Harcı",
  COLLECTION_FEE: "Tahsil Harcı",
  OTHER_EXPENSE: "Diğer Gider",
  OTHER: "Diğer",
} as const;

const incomeCategories: Category[] = ["PRINCIPAL", "PRE_FOLLOW_UP_INTEREST", "POST_FOLLOW_UP_INTEREST", "ATTORNEY_FEE", "EXPENSE_REFUND", "LITIGATION_EXPENSE", "PENALTY_COMPENSATION", "OTHER_INCOME"];
const expenseCategories: Category[] = ["FEE", "NOTIFICATION", "EXPERT_FEE", "ATTORNEY_PAYMENT", "EXPENSE", "PRISON_FEE", "COLLECTION_FEE", "OTHER_EXPENSE"];

const emptyData: Data = { items: [], totals: { income: "0.00", expense: "0.00", net: "0.00" }, caseNote: "" };

export default function PaymentModal({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const [data, setData] = useState<Data>(emptyData);
  const [type, setType] = useState<TransactionType>("INCOME");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [caseNote, setCaseNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [editingId, setEditingId] = useState("");
  const categories = type === "INCOME" ? incomeCategories : expenseCategories;

  function chooseType(nextType: TransactionType) {
    setType(nextType);
    setCategory("");
  }

  function resetEntry() {
    setEditingId(""); setType("INCOME"); setDate(""); setCategory(""); setAmount(""); setDescription(""); setFiles([]); setFileKey((value) => value + 1);
  }

  function edit(item: TransactionItem) {
    setEditingId(item.id); setType(item.type); setDate(item.transactionDate); setCategory(item.category); setAmount(money(item.amount)); setDescription(item.description); setFiles([]); setFileKey((value) => value + 1); setMessage("Düzenlemek istediğiniz kayıt yukarıya getirildi.");
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/cases/${encodeURIComponent(caseId)}/transactions`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { data?: Data; error?: { message?: string } };
        if (!response.ok || !result.data) throw new Error(result.error?.message ?? "Kayıtlar yüklenemedi.");
        setData(result.data);
        setCaseNote(result.data.caseNote);
      })
      .catch((error) => { if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(error instanceof Error ? error.message : "Kayıtlar yüklenemedi."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [caseId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !category) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(editingId ? `/api/cases/${encodeURIComponent(caseId)}/transactions/${encodeURIComponent(editingId)}` : `/api/cases/${encodeURIComponent(caseId)}/transactions`, {
        method: editingId ? "PATCH" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, category, transactionDate: date, amount: amount.trim() || "0", description, caseNote: caseNote.trim() || null }),
      });
      const result = await response.json() as { data?: Data; error?: { message?: string } };
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? (editingId ? "Kayıt güncellenemedi." : "Kayıt eklenemedi."));

      let nextData = result.data;
      let failedUploads = 0;
      const savedTransactionId = editingId || result.data.createdTransactionId;
      if (files.length > 0 && savedTransactionId) {
        for (const file of files) {
          const body = new FormData();
          body.set("file", file);
          body.set("documentName", file.name.replace(/\.[^.]+$/, ""));
          body.set("transactionId", savedTransactionId);
          const upload = await fetch(`/api/cases/${encodeURIComponent(caseId)}/documents`, { method: "POST", credentials: "same-origin", body });
          if (!upload.ok) failedUploads += 1;
        }
        const refreshed = await fetch(`/api/cases/${encodeURIComponent(caseId)}/transactions`, { credentials: "same-origin", cache: "no-store" });
        const refreshedResult = await refreshed.json() as { data?: Data };
        if (refreshed.ok && refreshedResult.data) nextData = refreshedResult.data;
      }
      setData(nextData);
      const wasEditing = Boolean(editingId);
      resetEntry();
      if (failedUploads > 0) setMessage(`${wasEditing ? "Kayıt güncellendi" : "Kayıt eklendi"}; ${failedUploads} belge yüklenemedi.`);
      else setMessage(wasEditing ? (files.length > 0 ? "Kayıt güncellendi ve belgeler eklendi." : "Kayıt güncellendi.") : (files.length > 0 ? "Kayıt ve belgeler eklendi." : "Kayıt eklendi."));
    } catch (error) { setMessage(error instanceof Error ? error.message : (editingId ? "Kayıt güncellenemedi." : "Kayıt eklenemedi.")); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Bu gelir/gider kaydını silmek istediğinize emin misiniz?")) return;
    setDeletingId(id); setMessage("");
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/transactions/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Kayıt silinemedi.");
      const refreshed = await fetch(`/api/cases/${encodeURIComponent(caseId)}/transactions`, { credentials: "same-origin", cache: "no-store" });
      const refreshedResult = await refreshed.json() as { data?: Data };
      if (!refreshed.ok || !refreshedResult.data) throw new Error("Kayıt listesi yenilenemedi.");
      setData(refreshedResult.data); if (editingId === id) resetEntry(); setMessage("Kayıt silindi.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kayıt silinemedi."); }
    finally { setDeletingId(""); }
  }

  return <div className={styles.backdrop} onMouseDown={onClose}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="payment-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div className={styles.headerIcon}>▱</div><div><h2 id="payment-title">Gelir / Gider Kaydı</h2><p>Gelir veya gider kalemini ekleyin, düzenleyin.</p></div><button type="button" aria-label="Pencereyi kapat" onClick={onClose}>×</button></header>
      <div className={styles.content}>
        <form className={styles.form} onSubmit={submit}>
          <h3>▤ <span>Gelir / Gider Bilgileri</span></h3>
          <fieldset><legend>İşlem Türü *</legend><div className={styles.typeButtons}><button type="button" className={type === "INCOME" ? styles.incomeActive : ""} onClick={() => chooseType("INCOME")}>↑ Gelir (Tahsilat)</button><button type="button" className={type === "EXPENSE" ? styles.expenseActive : ""} onClick={() => chooseType("EXPENSE")}>↓ Gider (Masraf)</button></div></fieldset>
          <div className={styles.twoColumns}>
            <label>Tarih *<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label>Kategori *<select required value={category} onChange={(event) => setCategory(event.target.value as Category)}><option value="" disabled>Kategori seçiniz</option>{categories.map((value) => <option value={value} key={value}>{categoryLabels[value]}</option>)}</select></label>
            <label>Tutar *<div className={styles.money}><input required inputMode="decimal" value={amount} onChange={(event) => setAmount(formatMoneyInput(event.target.value))} placeholder="0,00" /><b>TL</b></div></label>
            <label>Açıklama *<input required maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Açıklama giriniz" /></label>
          </div>
          <div className={styles.actions}><button type="button" onClick={editingId ? resetEntry : onClose}>{editingId ? "Düzenlemeden Vazgeç" : "Vazgeç"}</button><button type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : editingId ? "▣ Değişikliği Kaydet" : "▣ Kaydet"}</button></div>
          <div className={styles.fileLabel}><span>Belge Ekle (Opsiyonel)</span><label className={styles.fileBox} htmlFor="payment-document"><input id="payment-document" key={fileKey} multiple type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFiles((current) => mergeFiles(current, Array.from(event.target.files ?? [])))} /><b>⌕ {files.length > 0 ? `${files.length} belge seçildi` : "Dosyaları sürükleyin veya seçin"}</b><small>PDF, JPG, PNG (Belge başına maks. 20 MB)</small></label>{files.length > 0 && <div className={styles.selectedFiles}>{files.map((file, index) => <div key={`${file.name}-${file.size}-${file.lastModified}`}><SelectedFileRow file={file} onRemove={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} /></div>)}</div>}</div>
          <label className={styles.note}>▧ <b>Dosya Notu</b><textarea maxLength={2000} value={caseNote} onChange={(event) => setCaseNote(event.target.value)} placeholder="Bu dosyaya ait kalıcı not" /><small>{caseNote.length} / 2000</small></label>
          {message && <p className={styles.message}>{message}</p>}
        </form>
        <aside className={styles.side}>
          <section className={styles.records}><h3>ⓘ <span>Önceki Kayıtlar (Aynı Dosya)</span></h3><div className={styles.tableWrap}><table><thead><tr><th>Tarih</th><th>Tür</th><th>Kategori / Belge</th><th>Tutar (TL)</th><th /></tr></thead><tbody>{data.items.map((item) => <tr key={item.id}><td>{formatDate(item.transactionDate)}</td><td><span className={`${item.type === "INCOME" ? styles.incomeBadge : styles.expenseBadge} ${styles.transactionBadge}`} data-tooltip={item.description} title={item.description} tabIndex={0}>{item.type === "INCOME" ? "↑ Gelir" : "↓ Gider"}</span></td><td><span>{categoryLabels[item.category]}</span>{item.documents.length === 1 && <a className={styles.documentDownload} href={`/api/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(item.documents[0].id)}`} download={item.documents[0].originalName} title={`${item.documents[0].originalName} belgesini indir`}>◫ Belgeyi indir</a>}{item.documents.length > 1 && <details className={styles.documents}><summary>◫ {item.documents.length} belge</summary><div>{item.documents.map((document) => <a key={document.id} href={`/api/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(document.id)}`} download={document.originalName} title={`${document.originalName} belgesini indir`}>↓ {document.originalName}</a>)}</div></details>}</td><td className={item.type === "INCOME" ? styles.incomeAmount : styles.expenseAmount}>{money(item.amount)}</td><td><div className={styles.rowActions}><button type="button" disabled={saving || deletingId === item.id} aria-label="Kaydı düzenle" title="Kaydı düzenle" onClick={() => edit(item)}><ActionIcon name="edit" /></button><button type="button" disabled={saving || deletingId === item.id} aria-label="Kaydı sil" title="Kaydı sil" onClick={() => void remove(item.id)}><ActionIcon name="delete" /></button></div></td></tr>)}{!loading && data.items.length === 0 && <tr><td colSpan={5} className={styles.empty}>Henüz gelir/gider kaydı yok.</td></tr>}</tbody></table></div></section>
          <section className={styles.totals}><h3>▦ <span>Güncel Toplamlar</span></h3><div><article><span>Toplam Gelir</span><b className={styles.incomeAmount}>{money(data.totals.income)} TL</b></article><article><span>Toplam Gider</span><b className={styles.expenseAmount}>{money(data.totals.expense)} TL</b></article><article><span>Net Tutar</span><b>{money(data.totals.net)} TL</b></article></div></section>
        </aside>
      </div>
    </section>
  </div>;
}

function money(value: string) {
  const normalized = value.trim();
  const negative = normalized.startsWith("-");
  const cents = parseMoneyToCents(negative ? normalized.slice(1) : normalized);
  if (cents === null) return "0,00";
  return `${negative && cents > 0n ? "-" : ""}${centsToMoneyString(cents)}`;
}
function formatDate(value: string) { const [year, month, day] = value.split("-"); return `${day}.${month}.${year}`; }
function ActionIcon({ name }: { name: "edit" | "delete" }) { return <svg viewBox="0 0 24 24" aria-hidden="true">{name === "edit" ? <path d="M4 20h4l11-11-4-4L4 16v4Zm10-13 4 4m-2-6 2-2 4 4-2 2" /> : <path d="M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14M10 11v6m4-6v6" />}</svg>; }
function SelectedFileRow({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <><a className={styles.selectedFileDownload} href={url} download={file.name} title={`${file.name} belgesini indir`}>◫ <span>{file.name}</span> <small>{Math.ceil(file.size / 1024)} KB</small></a><button type="button" className={styles.removeSelectedFile} aria-label={`${file.name} belgesini kaldır`} onClick={onRemove}>×</button></>;
}
function mergeFiles(current: File[], added: File[]) {
  const files = [...current];
  const keys = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  for (const file of added) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!keys.has(key)) { files.push(file); keys.add(key); }
  }
  return files;
}
