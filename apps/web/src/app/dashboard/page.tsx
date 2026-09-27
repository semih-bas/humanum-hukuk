import Link from "next/link";

import AppShell from "@/components/app-shell/AppShell";
import { formatMoneyAmount } from "@/lib/case-presentation";
import { getDashboardSummary } from "@/lib/dashboard-summary";
import { requireSession } from "@/lib/session";

import DashboardClock from "./DashboardClock";
import styles from "./page.module.css";

const moduleMeta = {
  enforcement: { label: "İcra", href: "/dosyalarim", icon: "§", description: "Takip, haciz ve tahsilat süreçleri" },
  insurance: { label: "Sigorta ve Tahkim", href: "/sigorta-ve-tahkim", icon: "◇", description: "Sigorta uyuşmazlıkları ve tahkim" },
  general: { label: "Genel Dava ve Arabuluculuk", href: "/genel-dava-ve-arabuluculuk", icon: "◉", description: "Dava ve arabuluculuk dosyaları" },
} as const;

export default async function DashboardPage() {
  const session = await requireSession();
  const summary = await getDashboardSummary(session.user.role === "admin");

  return <AppShell pageTitle="Kontrol Merkezi" pageSubtitle="Genel Bakış">
    <div className={styles.dashboard}>
      <section className={styles.hero}>
        <div className={styles.heroTitle}><small>HUMANUM HUKUK</small><h2>Kontrol Merkezi</h2></div>
        <div className={styles.heroStats}>
          <article><i>▣</i><span>Toplam Dosya<strong>{summary.totals.total}</strong></span></article>
          <article><i>✓</i><span>Aktif Takip<strong>{summary.totals.active}</strong></span></article>
          <article><i>◫</i><span>Bu Hafta<strong>{summary.totals.thisWeek}</strong></span></article>
        </div>
        <DashboardClock />
      </section>

      <section className={styles.moduleGrid} aria-label="Dosya modülleri">
        {(Object.keys(moduleMeta) as Array<keyof typeof moduleMeta>).map((key) => {
          const meta = moduleMeta[key]; const counts = summary.modules[key];
          return <Link className={`${styles.moduleCard} ${styles[key]}`} href={meta.href} key={key}>
            <span className={styles.moduleIcon}>{meta.icon}</span>
            <span><strong>{meta.label}</strong><small>{meta.description}</small></span>
            <span className={styles.moduleCount}><b>{counts.active}</b><small>{counts.total} toplam</small></span>
            <i className={styles.arrow}>→</i>
          </Link>;
        })}
      </section>

      <section className={styles.timelinePanel}>
        <header><div><span className={styles.sectionIcon}>◫</span><span className={styles.sectionHeading}><h3>Kritik Tarihler</h3><small>Bekleyen bildirimler, görevler ve planlı duruşmalar</small></span></div><Link href="/hatirlatmalar">Tümünü gör <span>→</span></Link></header>
        {summary.criticalDates.length ? <div className={styles.timeline}>
          {summary.criticalDates.map((item) => <Link href={item.href} className={`${styles.timelineItem} ${styles[item.priority]}`} key={item.id}>
            <span className={styles.dot} /><time><b>{formatDay(item.date)}</b><small>{formatMonth(item.date)}</small></time>
            <span><strong>{item.title}</strong><small>{item.referenceNumber} · {moduleMeta[item.module].label}</small></span>
          </Link>)}
        </div> : <p className={styles.empty}>Bekleyen bildirim, görev veya planlı duruşma bulunmuyor.</p>}
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.listPanel}>
          <header><div><span className={styles.sectionIcon}>▰</span><h3>Son Dosyalar</h3></div><span>Üç modüldeki son güncellemeler</span></header>
          <div className={styles.rows}>
            {summary.recentFiles.map((item) => <Link href={item.href} className={styles.row} key={item.id}>
              <span className={`${styles.moduleBadge} ${styles[item.module]}`}>{moduleMeta[item.module].label}</span>
              <span><strong>{item.referenceNumber}</strong><small>{item.subject}</small></span>
              <time>{formatShortDate(item.updatedAt)}</time><b>›</b>
            </Link>)}
            {!summary.recentFiles.length && <p className={styles.empty}>Henüz dosya bulunmuyor.</p>}
          </div>
        </article>

        <article className={styles.listPanel}>
          <header><div><span className={styles.sectionIcon}>▥</span><h3>Mali Hareketler</h3></div><span>Üç modüldeki son kayıtlar</span></header>
          <div className={styles.rows}>
            {summary.financialMovements.map((item) => <Link href={item.href} className={styles.row} key={item.id}>
              <span className={`${styles.moneyMark} ${item.income ? styles.income : styles.expense}`}>{item.income ? "↑" : "↓"}</span>
              <span><strong>{item.description}</strong><small>{moduleMeta[item.module].label} · {formatShortDate(item.date)}</small></span>
              <em className={item.income ? styles.incomeText : styles.expenseText}>{item.income ? "+" : "−"}{formatMoneyAmount(item.amount)} TL</em><b>›</b>
            </Link>)}
            {!summary.financialMovements.length && <p className={styles.empty}>Henüz mali hareket bulunmuyor.</p>}
          </div>
        </article>
      </section>
    </div>
  </AppShell>;
}

function formatDay(value: string) { return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(value)); }
function formatMonth(value: string) { return new Intl.DateTimeFormat("tr-TR", { month: "short", timeZone: "Europe/Istanbul" }).format(new Date(value)).toLocaleUpperCase("tr-TR"); }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date(value)); }
