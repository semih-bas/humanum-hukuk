import { Dispatch, FormEvent, SetStateAction, useState } from "react";
import styles from "./NoteStep.module.css";

export type NoteDraft = { clientId: string; content: string; noteType: "GENERAL" | "ASSESSMENT" | "MEETING" | "REMINDER" | "STRATEGY" | "INFORMATION" | "OTHER"; visibility: "TEAM" | "PRIVATE"; important: boolean };
type Props = { caseId?: string; currentUser: { id: string; name: string }; notes: NoteDraft[]; setNotes: Dispatch<SetStateAction<NoteDraft[]>>; onBack: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean; error: string };
const types = [["GENERAL","Genel Not"],["ASSESSMENT","Değerlendirme"],["MEETING","Görüşme"],["REMINDER","Hatırlatma"],["STRATEGY","Strateji"],["INFORMATION","Bilgilendirme"],["OTHER","Diğer"]] as const;

export default function NoteStep({ caseId, currentUser, notes, setNotes, onBack, onSubmit, saving, error }: Props) {
  const [draft, setDraft] = useState<NoteDraft>(() => emptyNote());
  const [activityError, setActivityError] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  async function addNote() {
    if (!draft.content.trim() || noteSaving) return;
    setActivityError(""); setNoteSaving(true);
    try {
      let note = { ...draft, content: draft.content.trim() };
      if (caseId) {
        const response = await fetch(`/api/general-legal-cases/${encodeURIComponent(caseId)}/notes`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: note.content, noteType: note.noteType, visibility: note.visibility, important: note.important }) });
        const body = await response.json(); if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Not kaydedilemedi.");
        note = { ...note, clientId: body.data.id };
      }
      setNotes((current) => [note, ...current]); setDraft(emptyNote());
    } catch (cause) { setActivityError(cause instanceof Error ? cause.message : "Not kaydedilemedi."); }
    finally { setNoteSaving(false); }
  }
  async function removeNote(note: NoteDraft) {
    setActivityError("");
    try {
      if (caseId) { const response = await fetch(`/api/general-legal-cases/${encodeURIComponent(caseId)}/notes/${encodeURIComponent(note.clientId)}`, { method: "DELETE", credentials: "same-origin" }); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Not silinemedi."); }
      setNotes((current) => current.filter((item) => item.clientId !== note.clientId));
    } catch (cause) { setActivityError(cause instanceof Error ? cause.message : "Not silinemedi."); }
  }
  return <form className={styles.form} onSubmit={onSubmit}>{error && <p className={styles.error}>{error}</p>}
    <section className={styles.editor}><header><div><h2>Yeni Not Ekle</h2><p>Dosyayla ilgili önemli ayrıntıları ve çalışma notlarını kaydedin.</p></div><span>{draft.content.length.toLocaleString("tr-TR")} / 20.000</span></header><textarea maxLength={20000} value={draft.content} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} placeholder="Notunuzu buraya yazın…" /><div className={styles.controls}><label><span>Not Türü</span><select value={draft.noteType} onChange={(event) => setDraft((current) => ({ ...current, noteType: event.target.value as NoteDraft["noteType"] }))}>{types.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Görünürlük</span><select value={draft.visibility} onChange={(event) => setDraft((current) => ({ ...current, visibility: event.target.value as NoteDraft["visibility"] }))}><option value="TEAM">Tüm Ekip</option><option value="PRIVATE">Sadece Ben</option></select></label><label className={styles.check}><input type="checkbox" checked={draft.important} onChange={(event) => setDraft((current) => ({ ...current, important: event.target.checked }))} /><span>Önemli Not</span></label><button type="button" disabled={!draft.content.trim() || noteSaving} onClick={() => void addNote()}>{noteSaving ? "Kaydediliyor…" : "+ Notu Ekle"}</button></div>{activityError && <p className={styles.error}>{activityError}</p>}</section>
    <section className={styles.notes}><header className={styles.notesHeading}><div><h2>Notlar <span>{notes.length}</span></h2><p>En yeni notlar üstte gösterilir.</p></div></header>{notes.length === 0 ? <div className={styles.empty}><i>✎</i><b>Henüz not eklenmedi</b><span>Bu alan zorunlu değildir; gerektiğinde yukarıdan yeni bir not ekleyebilirsiniz.</span></div> : notes.map((note) => <article key={note.clientId}><div className={styles.author}><i>{initials(currentUser.name)}</i><span><b>{currentUser.name}</b><small>Şimdi</small></span></div><header><b>{typeLabel(note.noteType)}</b>{note.important && <em>Önemli</em>}<button type="button" onClick={() => void removeNote(note)}>Kaldır</button></header><p>{note.content}</p><small>{note.visibility === "TEAM" ? "Tüm ekip" : "Sadece ben"}</small></article>)}</section>
    <footer><button type="button" className={styles.back} onClick={onBack}>← Bildirimler</button><span>7 / 7 · Notlar</span><button type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet ve Tamamla"}</button></footer>
  </form>;
}
function emptyNote(): NoteDraft { return { clientId: crypto.randomUUID(), content: "", noteType: "GENERAL", visibility: "TEAM", important: false }; }
function typeLabel(value: NoteDraft["noteType"]) { return types.find(([key]) => key === value)?.[1] ?? "Not"; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("tr-TR")).join(""); }
