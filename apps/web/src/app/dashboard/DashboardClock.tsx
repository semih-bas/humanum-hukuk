"use client";

import { useEffect, useState } from "react";

import styles from "./page.module.css";

export default function DashboardClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return <div className={styles.clock} aria-label="Güncel tarih ve saat">
    <strong>{now ? new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(now) : "—"}</strong>
    <span>{now ? new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "Europe/Istanbul" }).format(now) : ""}</span>
    <time>{now ? new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(now) : "--:--"}</time>
  </div>;
}
