import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./PasswordRecoveryCard.module.css";

export default function PasswordRecoveryCard({ children, description, eyebrow, title }: {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return <main className={styles.page}>
    <section className={styles.card}>
      <header className={styles.header}>
        <Image src="/images/humanum-mark.png" alt="" width={48} height={48} priority />
        <div><p>{eyebrow}</p><h1>{title}</h1></div>
      </header>
      <p className={styles.description}>{description}</p>
      {children}
      <Link className={styles.backLink} href="/login">‹ Giriş ekranına dön</Link>
    </section>
  </main>;
}
