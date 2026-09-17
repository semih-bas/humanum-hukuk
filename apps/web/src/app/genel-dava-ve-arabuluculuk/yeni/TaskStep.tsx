import { Dispatch, FormEvent, SetStateAction, useState } from "react";

import styles from "./TaskStep.module.css";

export type TaskDraft = {
  clientId: string;
  title: string;
  description: string;
  assigneeUserId: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueAt: string;
  taskType: string;
  reminderOffsetMinutes: number | null;
  status: "PLANNED" | "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
};

const templates = [
  "Dava dilekçesi hazırlanacak", "Cevap dilekçesi değerlendirilecek",
  "Bilirkişi raporuna itiraz hazırlanacak", "Duruşma hazırlığı yapılacak",
  "Tebligat sonucu kontrol edilecek", "Müvekkile bilgilendirme yapılacak",
];

type Props = {
  currentUser: { id: string; name: string };
  tasks: TaskDraft[];
  setTasks: Dispatch<SetStateAction<TaskDraft[]>>;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string;
};

export default function TaskStep({ currentUser, tasks, setTasks, onBack, onSubmit, error }: Props) {
  const [draft, setDraft] = useState<TaskDraft>(() => emptyTask(currentUser.id));
  const [templatesOpen, setTemplatesOpen] = useState(false);
  function addTask() {
    if (!draft.title.trim() || !draft.dueAt) return;
    setTasks((current) => [...current, { ...draft, title: draft.title.trim(), description: draft.description.trim(), taskType: draft.taskType.trim() }]);
    setDraft(emptyTask(currentUser.id));
  }
  return <form className={styles.form} onSubmit={onSubmit}>
    {error && <p className={styles.error}>{error}</p>}
    <div className={styles.columns}>
      <section className={styles.panel}><h2>Yeni Görev Ekle</h2><div className={styles.grid}>
        <label className={styles.wide}><span>Görev Başlığı *</span><input maxLength={150} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
        <label className={styles.wide}><span>Açıklama</span><textarea maxLength={4000} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
        <label><span>Sorumlu</span><input value={currentUser.name} readOnly /></label>
        <label><span>Öncelik</span><select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as TaskDraft["priority"] }))}><option value="HIGH">Yüksek</option><option value="MEDIUM">Orta</option><option value="LOW">Düşük</option></select></label>
        <label><span>Son Tarih</span><input type="datetime-local" value={draft.dueAt} onChange={(event) => setDraft((current) => ({ ...current, dueAt: event.target.value }))} /></label>
        <label><span>Görev Türü</span><input maxLength={100} value={draft.taskType} onChange={(event) => setDraft((current) => ({ ...current, taskType: event.target.value }))} placeholder="Örn. İnceleme" /></label>
        <label><span>Hatırlatma</span><select value={draft.reminderOffsetMinutes ?? ""} onChange={(event) => setDraft((current) => ({ ...current, reminderOffsetMinutes: event.target.value ? Number(event.target.value) : null }))}><option value="">Yok</option><option value="1440">1 gün önce</option><option value="4320">3 gün önce</option><option value="10080">1 hafta önce</option></select></label>
      </div><button type="button" className={styles.add} onClick={addTask}>+ Görev Ekle</button></section>
      <section className={styles.panel}><header className={styles.templateHeader}><div><h2>Hızlı Görev Şablonları</h2><p>Sık kullanılan görevleri tek tıkla forma aktarın.</p></div><button type="button" onClick={() => setTemplatesOpen((value) => !value)}>{templatesOpen ? "Gizle" : "Şablondan Ekle"}</button></header>{templatesOpen ? <div className={styles.templates}>{templates.map((template) => <button type="button" key={template} onClick={() => { setDraft((current) => ({ ...current, title: template })); setTemplatesOpen(false); }}>+ {template}</button>)}</div> : <div className={styles.templateHint}>Şablonlar isteğe bağlıdır; görev ekleme formunu kalabalıklaştırmadan hız kazandırır.</div>}</section>
    </div>
    <section className={styles.list}><h2>Görev Listesi ({tasks.length})</h2>{tasks.length === 0 ? <p>Henüz görev eklenmedi. Bu alan zorunlu değildir.</p> : tasks.map((task) => <article key={task.clientId}><div><b>{task.title}</b><span>{task.taskType || "Genel"} · {formatDate(task.dueAt)}</span></div><em className={styles[task.priority.toLowerCase()]}>{priorityLabel(task.priority)}</em><button type="button" onClick={() => setTasks((current) => current.filter((item) => item.clientId !== task.clientId))}>Kaldır</button></article>)}</section>
    <footer><button type="button" className={styles.back} onClick={onBack}>← Evraklar</button><span>6 / 7 · Görevler</span><button type="submit">Notlara İlerle →</button></footer>
  </form>;
}

function emptyTask(userId: string): TaskDraft {
  const date = new Date(Date.now() + 86_400_000); date.setHours(17, 0, 0, 0);
  return { clientId: crypto.randomUUID(), title: "", description: "", assigneeUserId: userId, priority: "MEDIUM", dueAt: localDateTime(date), taskType: "", reminderOffsetMinutes: 1440, status: "PLANNED" };
}
function localDateTime(date: Date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16); }
function formatDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function priorityLabel(value: TaskDraft["priority"]) { return value === "HIGH" ? "Yüksek" : value === "LOW" ? "Düşük" : "Orta"; }
