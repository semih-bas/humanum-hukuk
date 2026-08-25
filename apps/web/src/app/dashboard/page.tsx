import AppShell from "@/components/app-shell/AppShell";
import styles from "./page.module.css";

const summaryCards = [
  { label: "Açık Dosyalar", value: 113, icon: "briefcase", tone: "gold" },
  { label: "Kapalı Dosyalar", value: 42, icon: "lock", tone: "green" },
  { label: "Toplam Dosya", value: 155, icon: "document", tone: "blue" },
] as const;

const tasks = [
  { title: "ABC Sigorta - Takım Duruşması", date: "12.05.2026", time: "10:30" },
  { title: "XYZ A.Ş. - İcra Takibi", date: "13.05.2026", time: "14:00" },
  { title: "Arabuluculuk Toplantısı", date: "15.05.2026", time: "11:00" },
];

function SummaryIcon({ name }: { name: "briefcase" | "lock" | "document" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === "briefcase" && <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>}
      {name === "lock" && <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>}
      {name === "document" && <><path d="M6 3h9l3 3v15H6Z" /><path d="M14 3v4h4M9 11h6M9 15h6" /></>}
    </svg>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <div className={styles.dashboard}>
        <header className={styles.pageHeader}>
          <div><p className={styles.eyebrow}>Genel Bakış</p><h1>Dashboard</h1><p>Genel durum özetinizi buradan görüntüleyebilirsiniz.</p></div>
          <p className={styles.today}>25 Ağustos 2026, Salı</p>
        </header>

        <section className={styles.summaryGrid} aria-label="Dosya özeti">
          {summaryCards.map((card) => (
            <article className={styles.summaryCard} key={card.label}>
              <span className={`${styles.summaryIcon} ${styles[card.tone]}`}><SummaryIcon name={card.icon} /></span>
              <div><p>{card.label}</p><strong>{card.value}</strong><small>tüm dosyalar</small></div>
            </article>
          ))}
        </section>

        <section className={styles.detailGrid}>
          <article className={styles.panel}>
            <header className={styles.panelHeader}><div><h2>Dosya Durum Dağılımı</h2><p>Aktif ve tamamlanan dosyalar</p></div></header>
            <div className={styles.distributionBody}>
              <div className={styles.donut} role="img" aria-label="113 açık, 42 kapalı dosya"><div><strong>155</strong><span>Toplam</span></div></div>
              <div className={styles.legend}>
                <p><span className={styles.openDot} />Açık Dosyalar <strong>113</strong><small>%72,9</small></p>
                <p><span className={styles.closedDot} />Kapalı Dosyalar <strong>42</strong><small>%27,1</small></p>
                <p><span className={styles.otherDot} />Diğer <strong>0</strong><small>%0</small></p>
              </div>
            </div>
          </article>

          <article className={styles.panel}>
            <header className={styles.panelHeader}><div><h2>Alacak Kalemleri</h2><p>Güncel finansal durum</p></div></header>
            <div className={styles.financeList}>
              <div><span>Toplam Alacak Tutarı</span><strong>2.346.919,58 TL</strong></div>
              <div><span>Tahsil Edilen Tutar</span><strong className={styles.positive}>1.124.598,74 TL</strong></div>
              <div><span>Tahsil Edilemeyen Tutar</span><strong className={styles.negative}>1.222.320,84 TL</strong></div>
            </div>
          </article>

          <article className={styles.panel}>
            <header className={styles.panelHeader}><div><h2>Yaklaşan Görevler</h2><p>En yakın üç hatırlatma</p></div><span className={styles.taskCount}>{tasks.length}</span></header>
            <div className={styles.taskList}>
              {tasks.map((task) => (
                <div className={styles.task} key={task.title}>
                  <span className={styles.calendarIcon}><span>{task.date.split(".")[0]}</span></span>
                  <div><strong>{task.title}</strong><small>{task.date} · {task.time}</small></div>
                </div>
              ))}
            </div>
            <button className={styles.allTasks} type="button">Tüm Görevler <span>→</span></button>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
