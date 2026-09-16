import { formatTimeInput, limitDateYear } from "@/lib/form-input";
import { Dispatch, FormEvent, SetStateAction, useState } from "react";

import styles from "./ProcessStep.module.css";

export const processStages = [
  ["CASE_OPENING", "Dava Açılışı"], ["NOTIFICATION", "Tebligat"], ["RESPONSE_PETITION", "Cevap Dilekçesi"],
  ["PRELIMINARY_REVIEW", "Ön İnceleme"], ["EXAMINATION", "Tahkikat"], ["EXPERT_REPORT", "Bilirkişi Raporu"],
  ["HEARING", "Duruşma"], ["DECISION", "Karar"], ["APPEAL", "İstinaf"], ["CASSATION", "Yargıtay"],
  ["FINALIZATION", "Kesinleşme"], ["COLLECTION", "Tahsilat"], ["CLOSED", "Dosya Kapanışı"],
] as const;

export type ProcessEntryDraft = { clientId: string; type: "STAGE_CHANGE" | "FILING" | "NOTIFICATION" | "HEARING" | "DECISION" | "OTHER"; stage: string; eventDate: string; action: string; description: string; responsibleUserId: string | null };
export type HearingDraft = { clientId: string; startsAt: string; court: string; hearingType: string; courtroom: string; attendeeUserId: string | null; reminderOffsetMinutes: number | null; note: string; status: "PLANNED" | "COMPLETED" | "POSTPONED" | "CANCELLED" };

type Props = {
  currentUser: { id: string; name: string };
  currentStage: string;
  onStageChange: (stage: string) => void;
  entries: ProcessEntryDraft[];
  setEntries: Dispatch<SetStateAction<ProcessEntryDraft[]>>;
  hearings: HearingDraft[];
  setHearings: Dispatch<SetStateAction<HearingDraft[]>>;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string;
};

export default function ProcessStep(props: Props) {
  const [entry, setEntry] = useState<ProcessEntryDraft>(() => emptyEntry(props.currentUser.id, props.currentStage));
  const [hearing, setHearing] = useState<HearingDraft>(() => emptyHearing(props.currentUser.id));
  const activeIndex = processStages.findIndex(([value]) => value === props.currentStage);

  function addEntry() {
    if (!entry.action.trim() || !entry.eventDate) return;
    props.setEntries((current) => [...current, { ...entry, action: entry.action.trim(), description: entry.description.trim() }]);
    if (entry.type === "STAGE_CHANGE") props.onStageChange(entry.stage);
    setEntry(emptyEntry(props.currentUser.id, entry.stage));
  }

  function addHearing() {
    if (!hearing.startsAt || !hearing.court.trim() || !hearing.hearingType.trim()) return;
    props.setHearings((current) => [...current, { ...hearing, court: hearing.court.trim(), hearingType: hearing.hearingType.trim(), courtroom: hearing.courtroom.trim(), note: hearing.note.trim() }]);
    setHearing(emptyHearing(props.currentUser.id));
  }

  return <form className={styles.form} onSubmit={props.onSubmit}>
    {props.error && <p className={styles.error}>{props.error}</p>}
    <section className={styles.timeline}><h2>Dava Süreci</h2><div>{processStages.map(([value, label], index) => <button type="button" key={value} className={index < activeIndex ? styles.past : index === activeIndex ? styles.active : ""} onClick={() => props.onStageChange(value)}><i>{index < activeIndex ? "✓" : index + 1}</i><span>{label}</span></button>)}</div></section>

    <div className={styles.columns}>
      <section className={styles.panel}><h2>Süreç İşlemi Ekle</h2><div className={styles.grid2}>
        <label><span>İşlem Türü</span><select value={entry.type} onChange={(event) => setEntry((current) => ({ ...current, type: event.target.value as ProcessEntryDraft["type"] }))}><option value="STAGE_CHANGE">Aşama Değişikliği</option><option value="FILING">Dilekçe / Başvuru</option><option value="NOTIFICATION">Tebligat</option><option value="HEARING">Duruşma İşlemi</option><option value="DECISION">Karar</option><option value="OTHER">Diğer</option></select></label>
        <label><span>Aşama</span><select value={entry.stage} onChange={(event) => setEntry((current) => ({ ...current, stage: event.target.value }))}>{processStages.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>İşlem Tarihi</span><input type="date" max={today()} value={entry.eventDate} onChange={(event) => setEntry((current) => ({ ...current, eventDate: limitDateYear(event.target.value, current.eventDate) }))} /></label>
        <label><span>Sorumlu</span><input value={props.currentUser.name} readOnly /></label>
        <label className={styles.wide}><span>İşlem *</span><input maxLength={150} value={entry.action} onChange={(event) => setEntry((current) => ({ ...current, action: event.target.value }))} placeholder="Örn. Cevap dilekçesi alındı" /></label>
        <label className={styles.wide}><span>Açıklama</span><textarea maxLength={4000} value={entry.description} onChange={(event) => setEntry((current) => ({ ...current, description: event.target.value }))} /></label>
      </div><button type="button" className={styles.add} onClick={addEntry}>+ Süreç İşlemi Ekle</button></section>

      <section className={styles.panel}><h2>Sonraki Duruşma</h2><div className={styles.grid2}>
        <label><span>Duruşma Tarihi</span><input type="date" min={today()} value={datePart(hearing.startsAt)} onChange={(event) => setHearing((current) => ({ ...current, startsAt: combineDateTime(limitDateYear(event.target.value, datePart(current.startsAt)), timePart(current.startsAt)) }))} /></label>
        <label><span>Saat</span><input inputMode="numeric" maxLength={5} value={timePart(hearing.startsAt)} onChange={(event) => setHearing((current) => ({ ...current, startsAt: combineDateTime(datePart(current.startsAt), formatTimeInput(event.target.value, timePart(current.startsAt))) }))} placeholder="SS:DD" /></label>
        <label className={styles.wide}><span>Mahkeme *</span><input maxLength={150} value={hearing.court} onChange={(event) => setHearing((current) => ({ ...current, court: event.target.value }))} /></label>
        <label><span>Duruşma Türü *</span><input maxLength={100} value={hearing.hearingType} onChange={(event) => setHearing((current) => ({ ...current, hearingType: event.target.value }))} placeholder="Örn. Tahkikat" /></label>
        <label><span>Salon</span><input maxLength={100} value={hearing.courtroom} onChange={(event) => setHearing((current) => ({ ...current, courtroom: event.target.value }))} /></label>
        <label><span>Hatırlatma</span><select value={hearing.reminderOffsetMinutes ?? ""} onChange={(event) => setHearing((current) => ({ ...current, reminderOffsetMinutes: event.target.value ? Number(event.target.value) : null }))}><option value="">Yok</option><option value="1440">1 gün önce</option><option value="4320">3 gün önce</option><option value="10080">1 hafta önce</option></select></label>
        <label><span>Katılacak</span><input value={props.currentUser.name} readOnly /></label>
        <label className={styles.wide}><span>Not</span><textarea maxLength={4000} value={hearing.note} onChange={(event) => setHearing((current) => ({ ...current, note: event.target.value }))} /></label>
      </div><button type="button" className={styles.add} onClick={addHearing}>+ Duruşma Ekle</button></section>
    </div>

    <section className={styles.records}><h2>Başlangıç Süreç Kayıtları</h2>{props.entries.length === 0 && props.hearings.length === 0 ? <p>Henüz süreç işlemi veya duruşma eklenmedi. Bu alan zorunlu değildir.</p> : <div className={styles.recordGrid}>{props.entries.map((item) => <article key={item.clientId}><b>{item.action}</b><span>{stageLabel(item.stage)} · {item.eventDate}</span><button type="button" onClick={() => props.setEntries((current) => current.filter((value) => value.clientId !== item.clientId))}>Kaldır</button></article>)}{props.hearings.map((item) => <article key={item.clientId}><b>{item.hearingType}</b><span>{item.court} · {formatLocalDateTime(item.startsAt)}</span><button type="button" onClick={() => props.setHearings((current) => current.filter((value) => value.clientId !== item.clientId))}>Kaldır</button></article>)}</div>}</section>
    <footer><button type="button" className={styles.back} onClick={props.onBack}>← Mali Bilgiler</button><span>4 / 7 · Dava Süreci</span><button type="submit">Evraklara İlerle →</button></footer>
  </form>;
}

function emptyEntry(userId: string, stage: string): ProcessEntryDraft { return { clientId: crypto.randomUUID(), type: "STAGE_CHANGE", stage, eventDate: today(), action: "", description: "", responsibleUserId: userId }; }
function emptyHearing(userId: string): HearingDraft { const date = new Date(Date.now() + 86_400_000); return { clientId: crypto.randomUUID(), startsAt: `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(date)}T10:00`, court: "", hearingType: "", courtroom: "", attendeeUserId: userId, reminderOffsetMinutes: 1440, note: "", status: "PLANNED" }; }
function today() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date()); }
function datePart(value: string) { return value.split("T")[0] ?? ""; }
function timePart(value: string) { return value.split("T")[1] ?? ""; }
function combineDateTime(date: string, time: string) { return date || time ? `${date}T${time}` : ""; }
function stageLabel(value: string) { return processStages.find(([stage]) => stage === value)?.[1] ?? value; }
function formatLocalDateTime(value: string) { if (!value) return "-"; return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
