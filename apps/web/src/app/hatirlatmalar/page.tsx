import Link from "next/link";
import { redirect } from "next/navigation";

import AppShell from "@/components/app-shell/AppShell";
import { listAdminReminderTasks } from "@/lib/admin-notifications";
import { requireSession } from "@/lib/session";

import styles from "./page.module.css";

const statusLabels: Record<string, string> = {
  PENDING: "Bekliyor",
  PARTIALLY_SENT: "Kısmen gönderildi",
  FAILED: "Gönderim başarısız",
};

export default async function RemindersPage() {
  const session = await requireSession();
  if (session.user.role !== "admin") redirect("/dashboard");
  const reminders = await listAdminReminderTasks();

  return <AppShell>
    <div className={styles.page}>
      <header><div><p>YÖNETİCİ</p><h1>Hatırlatmalar</h1><span>Yaklaşan, gecikmiş veya gönderimi tamamlanmamış görevler.</span></div><Link href="/dashboard">Dashboard&apos;a Dön</Link></header>
      <section className={styles.card}>
        <div className={styles.cardHeader}><h2>Tüm Görevler</h2><span>{reminders.totalCount} kayıt</span></div>
        <div className={styles.tableViewport}><table>
          <thead><tr><th>Hatırlatma</th><th>Dosya</th><th>Tarih</th><th>Kanallar</th><th>Durum</th><th>Ekleyen</th></tr></thead>
          <tbody>
            {reminders.items.map((reminder) => <tr key={reminder.id}>
              <td><strong>{reminder.title}</strong></td>
              <td><Link href={`/dosyalarim?query=${encodeURIComponent(reminder.caseFile.referenceNumber)}`}>{reminder.caseFile.referenceNumber}<small>{reminder.caseFile.vehiclePlate}</small></Link></td>
              <td>{formatDateTime(reminder.dueAt)}{reminder.overdue && <small className={styles.overdue}>Gecikmiş</small>}</td>
              <td>{[reminder.sendEmail && "E-posta", reminder.sendSms && "SMS"].filter(Boolean).join(" + ")}</td>
              <td><span className={`${styles.status} ${reminder.status === "FAILED" ? styles.failed : ""}`}>{statusLabels[reminder.status] ?? reminder.status}</span></td>
              <td>{reminder.createdBy.name}</td>
            </tr>)}
            {reminders.items.length === 0 && <tr><td className={styles.empty} colSpan={6}>Aktif hatırlatma bulunmuyor.</td></tr>}
          </tbody>
        </table></div>
        {reminders.totalCount > reminders.items.length && <p className={styles.limitNotice}>İlk {reminders.items.length} kayıt gösteriliyor.</p>}
      </section>
    </div>
  </AppShell>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(value));
}
