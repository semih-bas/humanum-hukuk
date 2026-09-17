"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import buttonStyles from "./new-button.module.css";
import styles from "./page.module.css";

type Kind = "GENERAL_LITIGATION" | "MEDIATION";
type Status = "DRAFT" | "ACTIVE" | "DECISION" | "APPEAL" | "COMPLETED" | "CLOSED";
type Stage = "CASE_OPENING" | "NOTIFICATION" | "RESPONSE_PETITION" | "PRELIMINARY_REVIEW" | "EXAMINATION" | "EXPERT_REPORT" | "HEARING" | "DECISION" | "APPEAL" | "CASSATION" | "FINALIZATION" | "COLLECTION" | "CLOSED";
type Party = { id: string; role: string; kind: string; name: string; identityOrTaxNumber?: string | null; phone?: string | null; email?: string | null; address?: string | null; representativeUserId?: string | null; representativeName?: string | null; clientType?: string | null; description?: string | null };
type Item = { id: string; referenceNumber: string; kind: Kind; caseType: string; subject: string; openingDate: string; caseValue: string; court: string | null; uyapMainNumber?: string | null; uyapDecisionNumber?: string | null; status: Status; stage: Stage; responsibleUser: { id: string; name: string }; parties: Party[]; updatedAt: string; lastProcess: { action: string; eventDate: string } | null; nextHearing: { startsAt: string; court: string; hearingType: string } | null };
type Detail = Item & { version: number; courthouse: string | null; courtType: string | null; procedure: string | null; urgent: boolean; confidentiality: "NORMAL" | "RESTRICTED"; estimatedCompletionDate: string | null; trackingGroup: string | null; tags: string[]; office: string | null; description: string | null; responsibleUserId: string; fileStaffUserId: string | null };
type ProcessData = { processEntries: Array<{ id: string; stage: Stage; eventDate: string; action: string; description: string | null; responsibleUser: { name: string } | null }>; hearings: Array<{ id: string; startsAt: string; court: string; hearingType: string; courtroom: string | null; status: string }> };
type Summary = { total: number; active: number; drafts: number; completed: number; decision: number; appeal: number; upcomingHearings: number; generalLitigation: number; mediation: number };
type Result = { items: Item[]; pagination: { page: number; pageSize: number; pageCount: number; totalCount: number }; summary: Summary };

const emptySummary: Summary = { total: 0, active: 0, drafts: 0, completed: 0, decision: 0, appeal: 0, upcomingHearings: 0, generalLitigation: 0, mediation: 0 };
const emptyResult: Result = { items: [], pagination: { page: 1, pageSize: 10, pageCount: 1, totalCount: 0 }, summary: emptySummary };
const statusLabels: Record<Status, string> = { DRAFT: "Taslak", ACTIVE: "Derdest", DECISION: "Karar", APPEAL: "İstinaf / Yargıtay", COMPLETED: "Sonuçlandı", CLOSED: "Kapalı" };
const stageEntries: Array<[Stage, string]> = [["CASE_OPENING", "Dava Açılışı"], ["NOTIFICATION", "Tebligat"], ["RESPONSE_PETITION", "Cevap Dilekçesi"], ["PRELIMINARY_REVIEW", "Ön İnceleme"], ["EXAMINATION", "Tahkikat"], ["EXPERT_REPORT", "Bilirkişi Raporu"], ["HEARING", "Duruşma"], ["DECISION", "Karar"], ["APPEAL", "İstinaf"], ["CASSATION", "Yargıtay"], ["FINALIZATION", "Kesinleşme"], ["COLLECTION", "Tahsilat"], ["CLOSED", "Dosya Kapanışı"]];
const stageLabels = Object.fromEntries(stageEntries) as Record<Stage, string>;

export default function GeneralLegalCasesClient() {
  const [result, setResult] = useState<Result>(emptyResult);
  const [query, setQuery] = useState(""); const [debounced, setDebounced] = useState("");
  const [kind, setKind] = useState("ALL"); const [status, setStatus] = useState("ALL"); const [stage, setStage] = useState("ALL");
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null); const [detail, setDetail] = useState<Detail | null>(null); const [process, setProcess] = useState<ProcessData | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false); const [drawerError, setDrawerError] = useState(""); const [drawerTab, setDrawerTab] = useState<"summary" | "process">("summary");
  const [editing, setEditing] = useState(false); const [edit, setEdit] = useState<Detail | null>(null); const [saving, setSaving] = useState(false); const [reload, setReload] = useState(0);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => { const timeout = window.setTimeout(() => setDebounced(query.trim()), 300); return () => window.clearTimeout(timeout); }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const parameters = new URLSearchParams({ query: debounced, kind, status, stage, dateFrom: "", dateTo: "", page: String(page), pageSize: String(pageSize) });
        const response = await fetch(`/api/general-legal-cases?${parameters}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal }); const body = await response.json();
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Dosyalar yüklenemedi."); setResult(body.data as Result);
      } catch (cause) { if (cause instanceof DOMException && cause.name === "AbortError") return; setError(cause instanceof Error ? cause.message : "Dosyalar yüklenemedi."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [debounced, kind, page, pageSize, reload, stage, status]);

  useEffect(() => {
    if (!selectedId) return; const controller = new AbortController();
    async function loadDrawer() {
      setDrawerLoading(true); setDrawerError(""); setDetail(null); setProcess(null); setEditing(false);
      try {
        const [detailResponse, processResponse] = await Promise.all([fetch(`/api/general-legal-cases/${selectedId}`, { cache: "no-store", signal: controller.signal }), fetch(`/api/general-legal-cases/${selectedId}/process`, { cache: "no-store", signal: controller.signal })]);
        const [detailBody, processBody] = await Promise.all([detailResponse.json(), processResponse.json()]);
        if (!detailResponse.ok || !detailBody.data) throw new Error(detailBody.error?.message ?? "Dosya özeti yüklenemedi.");
        setDetail(detailBody.data as Detail); setEdit(detailBody.data as Detail); if (processResponse.ok && processBody.data) setProcess(processBody.data as ProcessData);
        window.setTimeout(() => drawerRef.current?.focus(), 80);
      } catch (cause) { if (cause instanceof DOMException && cause.name === "AbortError") return; setDrawerError(cause instanceof Error ? cause.message : "Dosya özeti yüklenemedi."); }
      finally { if (!controller.signal.aborted) setDrawerLoading(false); }
    }
    void loadDrawer(); return () => controller.abort();
  }, [selectedId]);

  useEffect(() => { function closeOnEscape(event: globalThis.KeyboardEvent) { if (event.key === "Escape") closeDrawer(); } window.addEventListener("keydown", closeOnEscape); return () => window.removeEventListener("keydown", closeOnEscape); }, []);

  function clearFilters() { setQuery(""); setKind("ALL"); setStatus("ALL"); setStage("ALL"); setPage(1); }
  function openDrawer(id: string) { setSelectedId(id); setDrawerTab("summary"); }
  function closeDrawer() { setSelectedId(null); setDetail(null); setProcess(null); setEditing(false); }
  function rowKey(event: KeyboardEvent<HTMLTableRowElement>, id: string) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDrawer(id); } }
  function updateEdit<K extends keyof Detail>(field: K, value: Detail[K]) { setEdit((current) => current ? { ...current, [field]: value } : current); }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!edit || saving) return; setSaving(true); setDrawerError("");
    try {
      const response = await fetch(`/api/general-legal-cases/${edit.id}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        kind: edit.kind, caseType: edit.caseType, subject: edit.subject, openingDate: edit.openingDate, caseValue: edit.caseValue,
        uyapMainNumber: edit.uyapMainNumber ?? null, uyapDecisionNumber: edit.uyapDecisionNumber ?? null, courthouse: edit.kind === "GENERAL_LITIGATION" ? edit.courthouse : null,
        courtType: edit.kind === "GENERAL_LITIGATION" ? edit.courtType : null, court: edit.kind === "GENERAL_LITIGATION" ? edit.court : null,
        status: edit.status, stage: edit.stage, procedure: edit.procedure, urgent: edit.urgent, confidentiality: edit.confidentiality,
        estimatedCompletionDate: edit.estimatedCompletionDate, trackingGroup: edit.trackingGroup, tags: edit.tags, office: edit.office, description: edit.description,
        responsibleUserId: edit.responsibleUserId, fileStaffUserId: edit.fileStaffUserId,
        parties: edit.parties.map(({ role, kind: partyKind, name, identityOrTaxNumber, phone, email, address, representativeUserId, representativeName, clientType, description }) => ({ role, kind: partyKind, name, identityOrTaxNumber: identityOrTaxNumber ?? null, phone: phone ?? null, email: email ?? null, address: address ?? null, representativeUserId: representativeUserId ?? null, representativeName: representativeName ?? null, clientType: clientType ?? null, description: description ?? null })), version: edit.version,
      }) });
      const body = await response.json(); if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Dosya güncellenemedi.");
      setDetail(body.data as Detail); setEdit(body.data as Detail); setEditing(false); setReload((value) => value + 1);
    } catch (cause) { setDrawerError(cause instanceof Error ? cause.message : "Dosya güncellenemedi."); } finally { setSaving(false); }
  }

  const cards = [["Toplam Dava", result.summary.total, "▦", "blue", "Tüm dosyalar"], ["Derdest", result.summary.active, "⌂", "green", "Devam eden"], ["Karar Aşaması", result.summary.decision, "◐", "gold", "Karar bekleyen"], ["İstinaf / Yargıtay", result.summary.appeal, "◉", "purple", "Üst mahkeme"], ["Sonuçlanan", result.summary.completed, "↻", "cyan", "Karar verilen"], ["Yaklaşan Duruşma", result.summary.upcomingHearings, "♙", "red", "Planlı duruşma"]] as const;

  return <main className={styles.page}>
    <header className={`${styles.intro} ${buttonStyles.header}`}><div><p className={styles.crumb}>Ana Sayfa <span>›</span> Genel Dava ve Arabuluculuk</p><h1>Genel Dava ve Arabuluculuk</h1><p>Dava ve arabuluculuk dosyalarını, duruşmaları ve süreçleri tek ekrandan yönetin.</p></div><div className={styles.headerActions}><button type="button" className={styles.exportButton}>⇩ Dışa Aktar</button><Link className={buttonStyles.button} href="/genel-dava-ve-arabuluculuk/yeni">＋ Yeni Dosya</Link></div></header>
    <section className={styles.cards}>{cards.map(([label, value, icon, tone, hint]) => <article className={styles[tone]} key={label}><i>{icon}</i><div><strong>{value}</strong><span>{label}</span><small>{hint}</small></div></article>)}</section>
    <section className={styles.workspace}>
      <div className={styles.filters}><label className={styles.search}><span className={styles.srOnly}>Dosya ara</span><b>⌕</b><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Dosya no, taraf, mahkeme veya konu ara..." /></label>
        <label><span className={styles.srOnly}>Dosya alanı</span><select value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }}><option value="ALL">Tüm Dosya Alanları</option><option value="GENERAL_LITIGATION">Genel Dava</option><option value="MEDIATION">Arabuluculuk</option></select></label>
        <label><span className={styles.srOnly}>Durum</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="ALL">Tüm Durumlar</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span className={styles.srOnly}>Aşama</span><select value={stage} onChange={(event) => { setStage(event.target.value); setPage(1); }}><option value="ALL">Tüm Aşamalar</option>{stageEntries.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <button type="button" className={styles.filterButton}>▽ Filtrele</button><button type="button" className={styles.clearButton} onClick={clearFilters}>Temizle</button></div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.tableWrap}><table><thead><tr><th>#</th><th>Dosya No</th><th>Mahkeme / Birim</th><th>Dosya Türü</th><th>Müvekkil / Başvuran</th><th>Karşı Taraf</th><th>Dosya Değeri</th><th>Aşama</th><th>Son İşlem</th><th>Sonraki Duruşma</th><th>Sorumlu</th><th>Durum</th></tr></thead><tbody>
        {loading && <tr><td colSpan={12} className={styles.empty}>Dosyalar yükleniyor…</td></tr>}{!loading && !result.items.length && <tr><td colSpan={12} className={styles.empty}>Henüz kayıtlı dosya bulunmuyor.</td></tr>}
        {!loading && result.items.map((item, index) => <tr key={item.id} tabIndex={0} role="button" aria-label={`${item.referenceNumber} dosyasını görüntüle`} className={selectedId === item.id ? styles.selectedRow : ""} onClick={() => openDrawer(item.id)} onKeyDown={(event) => rowKey(event, item.id)}><td>{(result.pagination.page - 1) * result.pagination.pageSize + index + 1}</td><td><b className={styles.caseNumber}>{item.referenceNumber}</b></td><td>{item.court ?? (item.kind === "MEDIATION" ? "Arabuluculuk Bürosu" : "—")}</td><td>{item.caseType}</td><td>{primaryParty(item.parties, item.kind, true)}</td><td>{primaryParty(item.parties, item.kind, false)}</td><td>{formatMoney(item.caseValue)}</td><td><span className={styles.stage}>{stageLabels[item.stage]}</span></td><td>{item.lastProcess?.action ?? "—"}</td><td className={item.nextHearing ? styles.hearingDate : ""}>{item.nextHearing ? formatDateTime(item.nextHearing.startsAt) : "—"}</td><td>{item.responsibleUser.name}</td><td><span className={`${styles.status} ${styles[`status_${item.status}`]}`}>{statusLabels[item.status]}</span></td></tr>)}
      </tbody></table></div><footer><p>Toplam <b>{result.pagination.totalCount}</b> kayıt listeleniyor</p><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>‹</button><b>{page}</b><button type="button" disabled={page === result.pagination.pageCount} onClick={() => setPage((value) => value + 1)}>›</button><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value="10">10 / sayfa</option><option value="20">20 / sayfa</option><option value="50">50 / sayfa</option></select></div></footer>
    </section>
    {selectedId && <aside className={styles.drawer} ref={drawerRef} tabIndex={-1} aria-label="Dosya özeti"><header className={styles.drawerHeader}><div><small>SEÇİLİ DOSYA</small><h2>Dosya Özeti</h2></div><button type="button" onClick={closeDrawer} aria-label="Dosya özetini kapat">×</button></header>
      {drawerLoading ? <div className={styles.drawerState}><span className={styles.spinner} />Dosya bilgileri yükleniyor…</div> : drawerError && !detail ? <div className={styles.drawerState}>{drawerError}</div> : detail && <><div className={styles.drawerIdentity}><div><strong>{detail.referenceNumber}</strong><span className={`${styles.status} ${styles[`status_${detail.status}`]}`}>{statusLabels[detail.status]}</span></div><p>{detail.court ?? (detail.kind === "MEDIATION" ? "Arabuluculuk" : "Mahkeme bilgisi yok")}</p><button type="button" onClick={() => { setEdit(detail); setEditing(true); }}>✎ Dosyayı Düzenle</button></div>
        {!editing && <><nav className={styles.drawerTabs}><button type="button" className={drawerTab === "summary" ? styles.activeTab : ""} onClick={() => setDrawerTab("summary")}>Genel Bilgiler</button><button type="button" className={drawerTab === "process" ? styles.activeTab : ""} onClick={() => setDrawerTab("process")}>Dava Süreci</button></nav><div className={styles.drawerBody}>{drawerTab === "summary" ? <SummaryPanel detail={detail} /> : <ProcessTimeline detail={detail} process={process} />}</div></>}
        {editing && edit && <EditForm edit={edit} saving={saving} error={drawerError} update={updateEdit} onCancel={() => { setEdit(detail); setEditing(false); setDrawerError(""); }} onSubmit={saveEdit} />}</>}
    </aside>}
  </main>;
}

function SummaryPanel({ detail }: { detail: Detail }) { return <><section className={styles.summaryGrid}><Info label="Dosya Türü" value={detail.caseType} /><Info label="Açılış Tarihi" value={formatDate(detail.openingDate)} /><Info label="Esas / Dosya No" value={detail.uyapMainNumber ?? "—"} /><Info label="Karar No" value={detail.uyapDecisionNumber ?? "—"} /><Info wide label="Dava Konusu" value={detail.subject} /><Info label="Dava Değeri" value={formatMoney(detail.caseValue)} /><Info label="Sorumlu" value={detail.responsibleUser.name} /></section><section className={styles.parties}><h3>Taraflar</h3>{detail.parties.map((party) => <div key={party.id}><span>{partyRoleLabel(party.role)}</span><strong>{party.name}</strong></div>)}</section><ProcessTimeline detail={detail} process={null} compact /></>; }
function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? styles.wideInfo : ""}><span>{label}</span><strong>{value}</strong></div>; }
function ProcessTimeline({ detail, process, compact = false }: { detail: Detail; process: ProcessData | null; compact?: boolean }) { const current = stageEntries.findIndex(([stage]) => stage === detail.stage); const dates = new Map(process?.processEntries.map((entry) => [entry.stage, entry.eventDate]) ?? []); const nextHearing = process?.hearings.find((hearing) => hearing.status === "PLANNED" && new Date(hearing.startsAt) >= new Date()); return <section className={styles.timelineSection}><h3>Dava Süreç Takibi</h3><ol className={`${styles.timeline} ${compact ? styles.compactTimeline : ""}`}>{stageEntries.map(([stage, label], index) => <li key={stage} className={index < current ? styles.done : index === current ? styles.current : ""}><i>{index < current ? "✓" : ""}</i><div><strong>{label}</strong>{index === current && <b>Devam Ediyor</b>}{dates.get(stage) && <span>{formatDate(dates.get(stage)!)}</span>}</div></li>)}</ol>{!compact && nextHearing && <div className={styles.nextHearing}><span>▣ Sonraki Duruşma</span><strong>{formatDateTime(nextHearing.startsAt)}</strong><small>{nextHearing.court}{nextHearing.courtroom ? ` · ${nextHearing.courtroom}` : ""}</small></div>}</section>; }

function EditForm({ edit, saving, error, update, onCancel, onSubmit }: { edit: Detail; saving: boolean; error: string; update: <K extends keyof Detail>(field: K, value: Detail[K]) => void; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { const litigation = edit.kind === "GENERAL_LITIGATION"; return <form className={styles.editForm} onSubmit={onSubmit}><header><h3>Dosyayı Düzenle</h3><p>Temel dosya ve süreç bilgilerini güncelleyin.</p></header>{error && <p className={styles.editError}>{error}</p>}<label><span>Dosya Türü *</span><input required maxLength={100} value={edit.caseType} onChange={(event) => update("caseType", event.target.value)} /></label><label><span>Dosya Konusu *</span><textarea required maxLength={4000} value={edit.subject} onChange={(event) => update("subject", event.target.value)} /></label><div className={styles.editColumns}><label><span>Açılış Tarihi *</span><input required type="date" value={edit.openingDate} onChange={(event) => update("openingDate", event.target.value)} /></label><label><span>Dosya Değeri</span><input inputMode="decimal" value={edit.caseValue} onChange={(event) => update("caseValue", moneyInput(event.target.value))} /></label></div>{litigation && <><label><span>Adliye *</span><input required maxLength={150} value={edit.courthouse ?? ""} onChange={(event) => update("courthouse", event.target.value)} /></label><label><span>Mahkeme Türü *</span><input required maxLength={100} value={edit.courtType ?? ""} onChange={(event) => update("courtType", event.target.value)} /></label><label><span>Mahkeme *</span><input required maxLength={150} value={edit.court ?? ""} onChange={(event) => update("court", event.target.value)} /></label></>}<div className={styles.editColumns}><label><span>Durum *</span><select value={edit.status} onChange={(event) => update("status", event.target.value as Status)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Aşama *</span><select value={edit.stage} onChange={(event) => update("stage", event.target.value as Stage)}>{stageEntries.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><label><span>Açıklama</span><textarea maxLength={4000} value={edit.description ?? ""} onChange={(event) => update("description", event.target.value)} /></label><footer><button type="button" onClick={onCancel} disabled={saving}>Vazgeç</button><button type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}</button></footer></form>; }

function primaryParty(parties: Party[], kind: Kind, first: boolean) { const role = kind === "MEDIATION" ? (first ? "APPLICANT" : "RESPONDENT") : (first ? "PLAINTIFF" : "DEFENDANT"); return parties.find((party) => party.role === role)?.name ?? "—"; }
function partyRoleLabel(role: string) { return ({ PLAINTIFF: "Müvekkil / Davacı", DEFENDANT: "Karşı Taraf / Davalı", APPLICANT: "Başvuran", RESPONDENT: "Karşı Taraf", INTERVENOR: "Müdahil", THIRD_PARTY: "Üçüncü Kişi", RELATED_INSTITUTION: "İlgili Kurum" } as Record<string, string>)[role] ?? "Diğer Taraf"; }
function formatMoney(value: string) { return `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} TL`; }
function formatDate(value: string) { const [year, month, day] = value.split("-"); return `${day}.${month}.${year}`; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function moneyInput(value: string) { const normalized = value.replace(",", ".").replace(/[^\d.]/g, ""); const [integer = "", ...decimals] = normalized.split("."); return decimals.length ? `${integer}.${decimals.join("").slice(0, 2)}` : integer; }
