import Link from "next/link";
import { redirect } from "next/navigation";

import AppShell from "@/components/app-shell/AppShell";
import { listAdminReminderTasks } from "@/lib/admin-notifications";
import { resourceIdSchema } from "@/lib/resource-id";
import { requireSession } from "@/lib/session";
import { formatIstanbulDateTime as formatDateTime } from "@/lib/case-presentation";

import styles from "./page.module.css";

const statusLabels: Record<string, string> = {
  SENT: "E-posta sunucusuna iletildi",
  PENDING: "E-posta bekliyor",
  PARTIALLY_SENT: "E-posta kontrol edilmeli",
  FAILED: "E-posta gönderilemedi",
};

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ reminder?: string }> }) {
  const session = await requireSession();
  if (session.user.role !== "admin") redirect("/dashboard");
  const selectedReminder = resourceIdSchema.safeParse((await searchParams).reminder);
  const selectedReminderId = selectedReminder.success ? selectedReminder.data : "";
  const reminders = await listAdminReminderTasks();

  return <AppShell>
    <div className={styles.page}>
      <header><div><p>YÖNETİCİ</p><h1>Hatırlatmalar</h1><span>Gecikmiş görevler önce, tarih sırasıyla eskiden yeniye gösterilir.</span></div><Link href="/dashboard">Dashboard&apos;a Dön</Link></header>
      <section className={styles.card}>
        <div className={styles.cardHeader}><div><h2>Tüm Hatırlatmalar</h2><small>E-postalar yalnızca aktif ve e-postası doğrulanmış yöneticilere gönderilir.</small></div><span>{reminders.totalCount} kayıt</span></div>
        <div className={styles.tableViewport}><table>
          <thead><tr><th>Hatırlatma</th><th>Bağlı Dosya</th><th>Tarih</th><th>E-posta Durumu</th><th>Ekleyen</th><th>İşlem</th></tr></thead>
          <tbody>
            {reminders.items.map((reminder) => <tr id={`reminder-${reminder.id}`} className={reminder.id === selectedReminderId ? styles.highlightedReminder : undefined} key={reminder.id}>
              <td><strong>{reminder.title}</strong></td>
              <td><span className={styles.caseReference}>{reminder.caseFile.referenceNumber}<small>{reminder.caseFile.vehiclePlate}</small></span></td>
              <td>{formatDateTime(reminder.dueAt)}{reminder.overdue && <small className={styles.overdue}>Gecikmiş</small>}</td>
              <td><span className={`${styles.status} ${reminder.status === "FAILED" ? styles.failed : reminder.overdue && reminder.status !== "SENT" ? styles.late : ""}`}>{reminder.deliveries.some((delivery) => delivery.status === "UNCERTAIN") ? "Gönderim sonucu belirsiz" : reminder.overdue && reminder.status === "PENDING" ? "Gönderim bekliyor" : statusLabels[reminder.status] ?? reminder.status}</span>
                {reminder.deliveries.some((delivery) => delivery.status === "UNCERTAIN") && <small>Tekrar gönderilmedi; posta sunucusu kaydı kontrol edilmeli.</small>}
                {reminder.deliveries.some((delivery) => delivery.failureCode === "RATE_LIMITED") && <small>Gönderim sınırı nedeniyle sırada bekliyor.</small>}
                {reminder.deliveries.length > 0 && <small>{reminder.deliveries.filter((delivery) => delivery.status === "SENT").length} / {reminder.deliveries.length} yöneticiye iletildi.</small>}
              </td>
              <td>{reminder.createdBy.name}</td>
              <td><Link className={styles.openCase} href={`/dosyalarim?case=${encodeURIComponent(reminder.caseFile.id)}`}>Dosyaya Git <span>→</span></Link></td>
            </tr>)}
            {reminders.items.length === 0 && <tr><td className={styles.empty} colSpan={6}>Hatırlatma bulunmuyor.</td></tr>}
          </tbody>
        </table></div>
        {reminders.totalCount > reminders.items.length && <p className={styles.limitNotice}>İlk {reminders.items.length} kayıt gösteriliyor.</p>}
      </section>
    </div>
  </AppShell>;
}
