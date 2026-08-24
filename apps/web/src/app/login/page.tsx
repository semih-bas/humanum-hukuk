"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import styles from "./page.module.css";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("Güvenli giriş altyapısı hazırlanıyor.");
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.brandPanel} aria-label="Humanum Hukuk">
        <div className={styles.brandContent}>
          <Image
            src="/images/humanum-mark.png"
            alt="Humanum Hukuk amblemi"
            width={72}
            height={72}
            priority
            className={styles.brandMark}
          />
          <div className={styles.brandTypography}>
            <p className={styles.brandName}>HUMANUM</p>
            <p className={styles.brandDescriptor}>HUKUK &amp; DANIŞMANLIK</p>
          </div>
        </div>
      </section>

      <section className={styles.loginVisual}>
        <form className={styles.loginCard} onSubmit={handleSubmit} noValidate>
          <header className={styles.cardHeader}>
            <h1>Hoş Geldiniz</h1>
            <p>Hesabınıza giriş yapın</p>
          </header>

          <label className={styles.field}>
            <span className={styles.srOnly}>Kullanıcı adı veya e-posta</span>
            <span className={styles.inputIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" /></svg>
            </span>
            <input type="email" name="email" placeholder="Kullanıcı Adı / E-posta" autoComplete="username" required />
          </label>

          <label className={styles.field}>
            <span className={styles.srOnly}>Şifre</span>
            <span className={styles.inputIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
            </span>
            <input type={showPassword ? "text" : "password"} name="password" placeholder="Şifre" autoComplete="current-password" required />
            <button className={styles.passwordToggle} type="button" aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
            </button>
          </label>

          <div className={styles.loginOptions}>
            <label className={styles.rememberMe}><input type="checkbox" name="rememberMe" /><span>Beni Hatırla</span></label>
            <button className={styles.forgotPassword} type="button">Şifremi Unuttum?</button>
          </div>

          <button className={styles.loginButton} type="submit">Giriş Yap</button>
          <p className={styles.formNotice} role="status" aria-live="polite">{notice}</p>
          <p className={styles.copyright}>© 2026 Humanum Hukuk - Tüm hakları saklıdır.</p>
        </form>
      </section>
    </main>
  );
}
