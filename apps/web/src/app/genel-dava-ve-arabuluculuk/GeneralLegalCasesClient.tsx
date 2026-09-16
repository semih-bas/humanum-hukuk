"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

type Kind = "GENERAL_LITIGATION" | "MEDIATION";
type Status = "DRAFT" | "ACTIVE" | "DECISION" | "APPEAL" | "COMPLETED" | "CLOSED";
type Stage = "CASE_OPENING" | "NOTIFICATION" | "RESPONSE_PETITION" | "PRELIMINARY_REVIEW" | "EXAMINATION" | "EXPERT_REPORT" | "HEARING" | "DECISION" | "APPEAL" | "CASSATION" | "FINALIZATION" | "COLLECTION" | "CLOSED";
type Party = { id: string; role: string; kind: string; name: string };
type Item = { id: string; referenceNumber: string; kind: Kind; caseType: string; subject: string; openingDate: string; caseValue: string; court: string | null; status: Status; stage: Stage; responsibleUser: { id: string; name: string }; parties: Party[]; updatedAt: string };
type Result = { items: Item[]; pagination: { page: number; pageSize: number; pageCount: number; totalCount: number }; summary: { total: number; active: number; drafts: number; completed: number; generalLitigation: number; mediation: number } };

const emptyResult: Result = { items: [], pagination: { page: 1, pageSize: 10, pageCount: 1, totalCount: 0 }, summary: { total: 0, active: 0, drafts: 0, completed: 0, generalLitigation: 0, mediation: 0 } };
const statusLabels: Record<Status, string> = { DRAFT: "Taslak", ACTIVE: "Devam Ediyor", DECISION: "Karar", APPEAL: "Kanun Yolu", COMPLETED: "Sonuçlandı", CLOSED: "Kapalı" };
const stageLabels: Record<Stage, string> = { CASE_OPENING: "Dava Açılışı", NOTIFICATION: "Tebligat", RESPONSE_PETITION: "Cevap Dilekçesi", PRELIMINARY_REVIEW: "Ön İnceleme", EXAMINATION: "Tahkikat", EXPERT_REPORT: "Bilirkişi Raporu", HEARING: "Duruşma", DECISION: "Karar", APPEAL: "İstinaf", CASSATION: "Yargıtay", FINALIZATION: "Kesinleşme", COLLECTION: "Tahsilat", CLOSED: "Dosya Kapanışı" };

export default function GeneralLegalCasesClient() {
  const [result, setResult] = useState<Result>(emptyResult);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [kind, setKind] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [stage, setStage] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const parameters = new URLSearchParams({ query: debounced, kind, status, stage, dateFrom, dateTo, page: String(page), pageSize: String(pageSize) });
        const response = await fetch(`/api/general-legal-cases?${parameters}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Dosyalar yüklenemedi.");
        setResult(body.data as Result);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Dosyalar yüklenemedi.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [dateFrom, dateTo, debounced, kind, page, pageSize, stage, status]);

  function clearFilters() {
    setQuery(""); setKind("ALL"); setStatus("ALL"); setStage("ALL"); setDateFrom(""); setDateTo(""); setPage(1);
  }

  const cards = [
    ["Toplam Dosya", result.summary.total, "blue"],
    ["Genel Dava", result.summary.generalLitigation, "blue"],
    ["Arabuluculuk", result.summary.mediation, "gold"],
    ["Aktif", result.summary.active, "green"],
    ["Tamamlandı", result.summary.completed, "gray"],
  ] as const;

  return <main className={styles.page}>
    <header className={styles.intro}><h1>Genel Dava ve Arabuluculuk</h1><p>Dava ve arabuluculuk dosyalarını tek, güvenli çalışma alanından takip edin.</p></header>
    <section className={styles.cards}>{cards.map(([label, value, tone]) => <article className={styles[tone]} key={label}><strong>{value}</strong><span>{label}</span></article>)}</section>
    <section className={styles.workspace}>
      <div className={styles.filters}>
        <label className={styles.search}><span>Dosya Ara</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Dosya no, taraf, mahkeme veya konu..." /></label>
        <label><span>Dosya Türü</span><select value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }}><option value="ALL">Tümü</option><option value="GENERAL_LITIGATION">Genel Dava</option><option value="MEDIATION">Arabuluculuk</option></select></label>
        <label><span>Durum</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="ALL">Tümü</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Aşama</span><select value={stage} onChange={(event) => { setStage(event.target.value); setPage(1); }}><option value="ALL">Tümü</option>{Object.entries(stageLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Açılış Tarihi</span><div className={styles.dates}><input aria-label="Başlangıç tarihi" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /><input aria-label="Bitiş tarihi" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></div></label>
        <button type="button" onClick={clearFilters}>Temizle</button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.tableWrap}><table><thead><tr><th>#</th><th>Dosya No</th><th>Tür</th><th>Müvekkil / Başvuran</th><th>Karşı Taraf</th><th>Mahkeme</th><th>Konu</th><th>Değer</th><th>Aşama</th><th>Durum</th><th>Sorumlu</th><th>Açılış</th></tr></thead><tbody>
        {loading && <tr><td colSpan={12} className={styles.empty}>Dosyalar yükleniyor…</td></tr>}
        {!loading && !result.items.length && <tr><td colSpan={12} className={styles.empty}>Henüz kayıtlı dosya bulunmuyor.</td></tr>}
        {!loading && result.items.map((item, index) => <tr key={item.id}><td>{(result.pagination.page - 1) * result.pagination.pageSize + index + 1}</td><td><b>{item.referenceNumber}</b></td><td>{item.kind === "MEDIATION" ? "Arabuluculuk" : "Genel Dava"}</td><td>{primaryParty(item.parties, item.kind, true)}</td><td>{primaryParty(item.parties, item.kind, false)}</td><td>{item.court ?? "—"}</td><td className={styles.subject}>{item.subject}</td><td>{formatMoney(item.caseValue)}</td><td><span className={styles.stage}>{stageLabels[item.stage]}</span></td><td><span className={`${styles.status} ${styles[`status_${item.status}`]}`}>{statusLabels[item.status]}</span></td><td>{item.responsibleUser.name}</td><td>{formatDate(item.openingDate)}</td></tr>)}
      </tbody></table></div>
      <footer><p>Toplam {result.pagination.totalCount} kayıt listeleniyor.</p><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>‹</button><b>{page}</b><button type="button" disabled={page === result.pagination.pageCount} onClick={() => setPage((value) => value + 1)}>›</button><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value="10">10 / sayfa</option><option value="20">20 / sayfa</option><option value="50">50 / sayfa</option></select></div></footer>
    </section>
  </main>;
}

function primaryParty(parties: Party[], kind: Kind, first: boolean) {
  const role = kind === "MEDIATION" ? (first ? "APPLICANT" : "RESPONDENT") : (first ? "PLAINTIFF" : "DEFENDANT");
  return parties.find((party) => party.role === role)?.name ?? "—";
}

function formatMoney(value: string) {
  return `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} TL`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}
