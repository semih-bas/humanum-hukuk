"use client";

import { useMemo, useRef, useState } from "react";
import { notificationLeadLabel, notificationPriorityLabel, notificationTime, type NotificationPriority } from "@/lib/notification-schedule";
import styles from "./CaseNotifications.module.css";

export type CaseNotificationItem = {
  id: string;
  title: string;
  description: string | null;
  reminderType: string | null;
  priority: NotificationPriority;
  eventAt: string;
  notifyAt: string;
  status: string;
  sentAt?: string | null;
  creator: { name: string };
};

type Draft = { title: string; description: string; reminderType: string; priority: NotificationPriority; eventAt: string };
type Filter = "ALL" | "APPROACHING" | "OVERDUE" | "SENT";

export default function CaseNotifications({ caseId, apiBase, resourceName = "notifications", initialItems, onItemsChange, currentUserName, readOnly = false }: { caseId?: string; apiBase?: string; resourceName?: "notifications" | "reminders"; initialItems: CaseNotificationItem[]; onItemsChange?: (items: CaseNotificationItem[]) => void; currentUserName: string; readOnly?: boolean }) {
  const formRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [editingId, setEditingId] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState("");

  function commit(next: CaseNotificationItem[]) { setItems(next); onItemsChange?.(next); }
  async function submit() {
    setError(""); setMessage("");
    if (!draft.title.trim()) return setError("Bildirim başlığını giriniz.");
    if (!draft.eventAt || new Date(draft.eventAt).getTime() <= Date.now()) return setError("Takip tarihi gelecekte olmalıdır.");
    const payload = { title: draft.title.trim(), description: draft.description.trim() || null, reminderType: draft.reminderType.trim() || null, priority: draft.priority, eventAt: new Date(draft.eventAt).toISOString() };
    setSaving(true);
    try {
      if (caseId && apiBase) {
        const url = editingId ? `${apiBase}/${encodeURIComponent(caseId)}/${resourceName}/${encodeURIComponent(editingId)}` : `${apiBase}/${encodeURIComponent(caseId)}/${resourceName}`;
        const response = await fetch(url, { method: editingId ? "PATCH" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const body = await response.json();
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Bildirim kaydedilemedi.");
        commit(sortItems(editingId ? items.map((item) => item.id === editingId ? body.data : item) : [...items, body.data]));
      } else {
        const eventAt = new Date(draft.eventAt); const notifyAt = notificationTime(eventAt, draft.priority);
        const item: CaseNotificationItem = { id: editingId || crypto.randomUUID(), ...payload, eventAt: eventAt.toISOString(), notifyAt: notifyAt.toISOString(), status: "PENDING", creator: { name: currentUserName } };
        commit(sortItems(editingId ? items.map((current) => current.id === editingId ? item : current) : [...items, item]));
      }
      setMessage(editingId ? "Bildirim güncellendi." : "Bildirim eklendi."); setEditingId(""); setDraft(emptyDraft());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Bildirim kaydedilemedi."); }
    finally { setSaving(false); }
  }
  function edit(item: CaseNotificationItem) {
    setEditingId(item.id); setDraft({ title: item.title, description: item.description ?? "", reminderType: item.reminderType ?? "", priority: item.priority, eventAt: localDateTime(new Date(item.eventAt)) }); setError(""); setMessage(""); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function cancelEdit() { setEditingId(""); setDraft(emptyDraft()); setError(""); }
  async function remove(item: CaseNotificationItem) {
    if (removingId || !window.confirm(`“${item.title}” bildirimini silmek istiyor musunuz?`)) return;
    setRemovingId(item.id); setError(""); setMessage("");
    try {
      if (caseId && apiBase) { const response = await fetch(`${apiBase}/${encodeURIComponent(caseId)}/${resourceName}/${encodeURIComponent(item.id)}`, { method: "DELETE", credentials: "same-origin" }); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Bildirim silinemedi."); }
      commit(items.filter((current) => current.id !== item.id)); if (editingId === item.id) cancelEdit(); setMessage("Bildirim silindi.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Bildirim silinemedi."); }
    finally { setRemovingId(""); }
  }
  const classified = useMemo(() => items.map((item) => ({ item, state: displayState(item) })), [items]);
  const visible = classified.filter(({ state }) => filter === "ALL" || state.key === filter);
  const counts = (key: Filter) => key === "ALL" ? items.length : classified.filter(({ state }) => state.key === key).length;

  return <section className={styles.board}>
    <header className={styles.heading}><div><h2>Bildirimler <span>{items.length}</span></h2><p>Önceliğe göre hatırlatma zamanı otomatik ayarlanır ve önemli işler önce gösterilir.</p></div></header>
    {!readOnly && <div ref={formRef} className={styles.composer}>
      <header><div><h3>{editingId ? "Bildirimi Düzenle" : "Yeni Bildirim"}</h3><p>{editingId ? "Seçilen bildirimin bilgileri forma taşındı." : "Takip edilecek işi ve hedef tarihini kaydedin."}</p></div><span>{notificationPriorityLabel(draft.priority)} · {notificationLeadLabel(draft.priority)}</span></header>
      <div className={styles.fields}>
        <label className={styles.title}><span>Bildirim Başlığı *</span><input maxLength={150} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Örn. Duruşma tarihini kontrol et" /></label>
        <label><span>Bildirim Türü</span><input maxLength={100} value={draft.reminderType} onChange={(event) => setDraft((current) => ({ ...current, reminderType: event.target.value }))} placeholder="Örn. Duruşma" /></label>
        <label><span>Öncelik</span><select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as NotificationPriority }))}><option value="HIGH">Çok Önemli</option><option value="MEDIUM">Önemli</option><option value="LOW">Az Önemli</option></select></label>
        <label><span>Takip Tarihi *</span><input type="datetime-local" value={draft.eventAt} onChange={(event) => setDraft((current) => ({ ...current, eventAt: event.target.value }))} /></label>
        <label className={styles.description}><span>Açıklama</span><textarea maxLength={4000} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="İşlem için gerekli kısa açıklama…" /></label>
      </div>
      <footer><div><b>Oluşturan</b><span>{currentUserName}</span></div><div className={styles.formActions}>{editingId && <button type="button" className={styles.cancel} onClick={cancelEdit}>Vazgeç</button>}<button type="button" disabled={saving} onClick={() => void submit()}>{saving ? "Kaydediliyor…" : editingId ? "Değişiklikleri Kaydet" : "+ Bildirim Ekle"}</button></div></footer>
    </div>}
    {(error || message) && <p className={error ? styles.error : styles.message}>{error || message}</p>}
    <nav className={styles.filters}>{([['ALL','Tümü'],['APPROACHING','Yaklaşan'],['OVERDUE','Gecikmiş'],['SENT','Bildirim Gönderildi']] as Array<[Filter,string]>).map(([key,label]) => <button type="button" key={key} className={filter === key ? styles.active : ""} onClick={() => setFilter(key)}>{label}<span>{counts(key)}</span></button>)}</nav>
    <div className={styles.list}>{visible.map(({ item, state }) => <article key={item.id} className={`${styles.card} ${styles[item.priority.toLowerCase()]}`}>
      <div className={styles.icon}>♧</div><div className={styles.content}><header><div><b>{item.title}</b><span>{item.reminderType || "Genel Bildirim"}</span></div><time>{formatDate(item.eventAt)}</time></header>{item.description && <p>{item.description}</p>}<footer><span>Oluşturan: <b>{item.creator.name}</b></span><span>Hatırlatma: {formatDate(item.notifyAt)}</span></footer></div>
      <aside><em className={styles[`status${state.tone}`]}>{state.label}</em><strong>{notificationPriorityLabel(item.priority)}</strong><div>{isEditable(item.status) && <button type="button" onClick={() => edit(item)}>Düzenle</button>}<button type="button" className={styles.delete} disabled={removingId === item.id} onClick={() => void remove(item)}>{removingId === item.id ? "…" : "Sil"}</button></div></aside>
    </article>)}{!visible.length && <div className={styles.empty}><b>Bu durumda bildirim yok</b><span>Yeni bir bildirim ekleyebilir veya başka bir filtre seçebilirsiniz.</span></div>}</div>
  </section>;
}

function emptyDraft(): Draft { const date = new Date(Date.now() + 3 * 86_400_000); date.setHours(10, 0, 0, 0); return { title: "", description: "", reminderType: "", priority: "MEDIUM", eventAt: localDateTime(date) }; }
function localDateTime(date: Date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16); }
function formatDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(value)); }
function displayState(item: CaseNotificationItem): { key: Exclude<Filter,"ALL"> | "PLANNED" | "FAILED"; label: string; tone: string } { if (item.status === "SENT" || item.status === "COMPLETED") return { key: "SENT", label: "Bildirim Gönderildi", tone: "Sent" }; if (item.status === "PARTIALLY_SENT") return { key: "SENT", label: "Kısmen Gönderildi", tone: "Warning" }; if (item.status === "FAILED") return { key: "FAILED", label: "Gönderilemedi", tone: "Danger" }; const now = Date.now(); if (new Date(item.eventAt).getTime() <= now) return { key: "OVERDUE", label: "Gecikmiş", tone: "Danger" }; if (new Date(item.notifyAt).getTime() <= now) return { key: "APPROACHING", label: "Yaklaşan", tone: "Warning" }; return { key: "PLANNED", label: "Planlandı", tone: "Planned" }; }
function sortItems(items: CaseNotificationItem[]) { const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 }; return [...items].sort((a,b) => priority[a.priority] - priority[b.priority] || a.eventAt.localeCompare(b.eventAt)); }
function isEditable(status: string) { return ["PENDING", "PLANNED", "WAITING", "IN_PROGRESS"].includes(status); }
