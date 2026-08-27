import type { CSSProperties } from "react";
import Link from "next/link";

import AppShell from "@/components/app-shell/AppShell";
import { getDashboardSummary } from "@/lib/dashboard-summary";
import { requireSession } from "@/lib/session";

import styles from "./page.module.css";

function SummaryIcon({ name }: { name: "briefcase" | "lock" | "document" }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    {name === "briefcase" && <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>}
    {name === "lock" && <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>}
    {name === "document" && <><path d="M6 3h9l3 3v15H6Z" /><path d="M14 3v4h4M9 11h6M9 15h6" /></>}
  </svg>;
}

export default async function DashboardPage() {
  const session = await requireSession();
  const isManager = session.user.role === "admin";
  const summary = await getDashboardSummary(isManager);
  const summaryCards = [
    { label: "Açık Dosyalar", value: summary.counts.open, icon: "briefcase", tone: "gold" },
    { label: "Kapalı Dosyalar", value: summary.counts.closed, icon: "lock", tone: "green" },
    { label: "Toplam Dosya", value: summary.counts.total, icon: "document", tone: "blue" },
  ] as const;
  const donutStyle: CSSProperties = {
    background: summary.counts.total === 0
      ? "#dce3e9"
      : `conic-gradient(#09223b 0 ${summary.percentages.open}%, #2f9b62 ${summary.percentages.open}% 100%)`,
  };

  return <AppShell>
    <div className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>Genel Bakış</p><h1>Dashboard</h1><p>Genel durum özetinizi buradan görüntüleyebilirsiniz.</p></div>
        <p className={styles.today}>{formatToday()}</p>
      </header>

      <section className={styles.summaryGrid} aria-label="Dosya özeti">
        {summaryCards.map((card) => <article className={styles.summaryCard} key={card.label}>
          <span className={`${styles.summaryIcon} ${styles[card.tone]}`}><SummaryIcon name={card.icon} /></span>
          <div><p>{card.label}</p><strong>{card.value}</strong><small>tüm dosyalar</small></div>
        </article>)}
      </section>

      <section className={`${styles.detailGrid} ${!isManager ? styles.detailGridTwo : ""}`}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}><div><h2>Dosya Durum Dağılımı</h2><p>Aktif ve tamamlanan dosyalar</p></div></header>
          <div className={styles.distributionBody}>
            <div className={styles.donut} style={donutStyle} role="img" aria-label={`${summary.counts.open} açık, ${summary.counts.closed} kapalı dosya`}><div><strong>{summary.counts.total}</strong><span>Toplam</span></div></div>
            <div className={styles.legend}>
              <p><span className={styles.openDot} />Açık Dosyalar <strong>{summary.counts.open}</strong><small>%{formatPercentage(summary.percentages.open)}</small></p>
              <p><span className={styles.closedDot} />Kapalı Dosyalar <strong>{summary.counts.closed}</strong><small>%{formatPercentage(summary.percentages.closed)}</small></p>
              <p><span className={styles.otherDot} />Diğer <strong>0</strong><small>%0</small></p>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}><div><h2>Alacak Kalemleri</h2><p>Güncel finansal durum</p></div></header>
          <div className={styles.financeList}>
            <div><span>Toplam Alacak Tutarı</span><strong>{formatMoney(summary.financials.totalReceivable)}</strong></div>
            <div><span>Tahsil Edilen Tutar</span><strong className={styles.positive}>{formatMoney(summary.financials.collected)}</strong></div>
            <div><span>Tahsil Edilemeyen Tutar</span><strong className={styles.negative}>{formatMoney(summary.financials.outstanding)}</strong></div>
          </div>
        </article>

        {isManager && <article className={styles.panel}>
          <header className={styles.panelHeader}><div><h2>Yaklaşan Görevler</h2><p>En yakın üç hatırlatma</p></div><span className={styles.taskCount}>{summary.reminders.length}</span></header>
          <div className={styles.taskList}>
            {summary.reminders.map((reminder) => <Link className={styles.task} href={`/dosyalarim?query=${encodeURIComponent(reminder.referenceNumber)}`} key={reminder.id}>
              <span className={styles.calendarIcon}><span>{formatDay(reminder.dueAt)}</span></span>
              <div><strong>{reminder.title}</strong><small>{reminder.referenceNumber} · {formatDateTime(reminder.dueAt)}</small></div>
            </Link>)}
            {summary.reminders.length === 0 && <p className={styles.emptyTasks}>Yaklaşan hatırlatma bulunmuyor.</p>}
          </div>
          <Link className={styles.allTasks} href="/hatirlatmalar">Tüm görevler <span>→</span></Link>
        </article>}
      </section>
    </div>
  </AppShell>;
}

function formatMoney(value: string): string {
  const [whole, fraction = "00"] = value.split(".");
  const groupedWhole = new Intl.NumberFormat("tr-TR").format(BigInt(whole));
  return `${groupedWhole},${fraction.padEnd(2, "0").slice(0, 2)} TL`;
}

function formatPercentage(value: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}

function formatToday(): string {
  return new Intl.DateTimeFormat("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Europe/Istanbul",
  }).format(new Date());
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}
