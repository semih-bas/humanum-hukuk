import { Dispatch, FormEvent, SetStateAction, useState } from "react";
import styles from "./NoteStep.module.css";

export type NoteDraft = { clientId: string; content: string; noteType: "GENERAL" | "ASSESSMENT" | "MEETING" | "REMINDER" | "STRATEGY" | "INFORMATION" | "OTHER"; visibility: "TEAM" | "PRIVATE"; important: boolean };
type Props = { notes: NoteDraft[]; setNotes: Dispatch<SetStateAction<NoteDraft[]>>; onBack: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean; error: string };
const types = [["GENERAL","Genel Not"],["ASSESSMENT","Değerlendirme"],["MEETING","Görüşme"],["REMINDER","Hatırlatma"],["STRATEGY","Strateji"],["INFORMATION","Bilgilendirme"],["OTHER","Diğer"]] as const;

export default function NoteStep({ notes, setNotes, onBack, onSubmit, saving, error }: Props) {
  const [draft, setDraft] = useState<NoteDraft>(() => emptyNote());
  function addNote() { if (!draft.content.trim()) return; setNotes((current) => [{ ...draft, content: draft.content.trim() }, ...current]); setDraft(emptyNote()); }
  return <form className={styles.form} onSubmit={onSubmit}>{error && <p className={styles.error}>{error}</p>}
    <section className={styles.editor}><h2>Yeni Not Ekle</h2><textarea maxLength={20000} value={draft.content} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} placeholder="Notunuzu buraya yazın…" /><div><label><span>Not Türü</span><select value={draft.noteType} onChange={(event) => setDraft((current) => ({ ...current, noteType: event.target.value as NoteDraft["noteType"] }))}>{types.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Görünürlük</span><select value={draft.visibility} onChange={(event) => setDraft((current) => ({ ...current, visibility: event.target.value as NoteDraft["visibility"] }))}><option value="TEAM">Tüm Ekip</option><option value="PRIVATE">Sadece Ben</option></select></label><label className={styles.check}><input type="checkbox" checked={draft.important} onChange={(event) => setDraft((current) => ({ ...current, important: event.target.checked }))} /><span>Önemli Not</span></label><button type="button" onClick={addNote}>+ Notu Ekle</button></div></section>
    <section className={styles.notes}><h2>Başlangıç Notları ({notes.length})</h2>{notes.length === 0 ? <p>Henüz not eklenmedi. Bu alan zorunlu değildir.</p> : notes.map((note) => <article key={note.clientId}><header><b>{typeLabel(note.noteType)}</b>{note.important && <em>Önemli</em>}<button type="button" onClick={() => setNotes((current) => current.filter((item) => item.clientId !== note.clientId))}>Kaldır</button></header><p>{note.content}</p><small>{note.visibility === "TEAM" ? "Tüm ekip" : "Sadece ben"}</small></article>)}</section>
    <footer><button type="button" className={styles.back} onClick={onBack}>← Görevler</button><span>7 / 7 · Notlar</span><button type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet ve Tamamla"}</button></footer>
  </form>;
}
function emptyNote(): NoteDraft { return { clientId: crypto.randomUUID(), content: "", noteType: "GENERAL", visibility: "TEAM", important: false }; }
function typeLabel(value: NoteDraft["noteType"]) { return types.find(([key]) => key === value)?.[1] ?? "Not"; }
