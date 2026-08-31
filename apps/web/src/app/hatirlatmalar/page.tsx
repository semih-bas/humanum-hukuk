import Link from "next/link";
import { redirect } from "next/navigation";

import AppShell from "@/components/app-shell/AppShell";
import { listAdminReminderTasks } from "@/lib/admin-notifications";
import { requireSession } from "@/lib/session";

import styles from "./page.module.css";

const statusLabels: Record<string, string> = {
  PENDING: "E-posta bekliyor",
  PARTIALLY_SENT: "E-posta kontrol edilmeli",
  FAILED: "E-posta gönderilemedi",
};

export default async function RemindersPage() {
  const session = await requireSession();
  if (session.user.role !== "admin") redirect("/dashboard");
  const reminders = await listAdminReminderTasks();

  return <AppShell>
    <div className={styles.page}>
      <header><div><p>YÖNETİCİ</p><h1>Hatırlatmalar</h1><span>Gecikmiş görevler önce, tarih sırasıyla eskiden yeniye gösterilir.</span></div><Link href="/dashboard">Dashboard&apos;a Dön</Link></header>
      <section className={styles.card}>
        <div className={styles.cardHeader}><div><h2>Aktif Görevler</h2><small>Bildirimler yalnızca e-posta ile gönderilir.</small></div><span>{reminders.totalCount} kayıt</span></div>
        <div className={styles.tableViewport}><table>
          <thead><tr><th>Hatırlatma</th><th>Bağlı Dosya</th><th>Tarih</th><th>E-posta Durumu</th><th>Ekleyen</th><th>İşlem</th></tr></thead>
          <tbody>
            {reminders.items.map((reminder) => <tr key={reminder.id}>
              <td><strong>{reminder.title}</strong></td>
              <td><span className={styles.caseReference}>{reminder.caseFile.referenceNumber}<small>{reminder.caseFile.vehiclePlate}</small></span></td>
              <td>{formatDateTime(reminder.dueAt)}{reminder.overdue && <small className={styles.overdue}>Gecikmiş</small>}</td>
              <td><span className={`${styles.status} ${reminder.status === "FAILED" ? styles.failed : reminder.overdue ? styles.late : ""}`}>{reminder.overdue && reminder.status === "PENDING" ? "Gönderim gecikti" : statusLabels[reminder.status] ?? reminder.status}</span></td>
              <td>{reminder.createdBy.name}</td>
              <td><Link className={styles.openCase} href={`/dosyalarim?case=${encodeURIComponent(reminder.caseFile.id)}`}>Dosyaya Git <span>→</span></Link></td>
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
