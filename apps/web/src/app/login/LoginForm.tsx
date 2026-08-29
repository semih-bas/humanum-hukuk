"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";
import styles from "./page.module.css";

type Notice = {
  kind: "error" | "info";
  message: string;
} | null;

export default function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const rememberMe = formData.get("rememberMe") === "on";

    setIsSubmitting(true);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
        rememberMe,
        callbackURL: `${window.location.origin}/login`,
      });

      if (error) {
        const emailNotVerified = error.status === 403 || error.code === "EMAIL_NOT_VERIFIED";
        setNotice({
          kind: emailNotVerified ? "info" : "error",
          message: emailNotVerified
            ? "E-posta adresiniz henüz doğrulanmadı. Yeni doğrulama bağlantısı e-posta adresinize gönderildi."
            : error.status === 429
            ? "Çok fazla giriş denemesi yapıldı. Lütfen kısa bir süre sonra tekrar deneyin."
            : "E-posta adresi veya şifre hatalı.",
        });
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setNotice({
        kind: "error",
        message: "Giriş servisine şu anda ulaşılamıyor. Lütfen tekrar deneyin.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.brandPanel} aria-label="Humanum Hukuk">
        <div className={styles.brandContent}>
          <Image src="/images/humanum-mark.png" alt="Humanum Hukuk amblemi" width={72} height={72} priority className={styles.brandMark} />
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
            <span className={styles.srOnly}>E-posta adresi</span>
            <span className={styles.inputIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" /></svg></span>
            <input type="email" name="email" placeholder="E-posta Adresi" autoComplete="username" required disabled={isSubmitting} />
          </label>

          <label className={styles.field}>
            <span className={styles.srOnly}>Şifre</span>
            <span className={styles.inputIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg></span>
            <input type={showPassword ? "text" : "password"} name="password" placeholder="Şifre" autoComplete="current-password" required disabled={isSubmitting} />
            <button className={styles.passwordToggle} type="button" aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)} disabled={isSubmitting}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
            </button>
          </label>

          <div className={styles.loginOptions}>
            <label className={styles.rememberMe}><input type="checkbox" name="rememberMe" disabled={isSubmitting} /><span>Beni Hatırla</span></label>
            <Link className={styles.forgotPassword} href="/sifremi-unuttum">Şifremi Unuttum?</Link>
          </div>

          <button className={styles.loginButton} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? "Giriş yapılıyor..." : "Giriş Yap"}</button>
          <p className={`${styles.formNotice} ${notice?.kind === "error" ? styles.formNoticeError : ""}`} role="status" aria-live="polite">{notice?.message ?? ""}</p>
          <p className={styles.copyright}>© 2026 Humanum Hukuk - Tüm hakları saklıdır.</p>
        </form>
      </section>
    </main>
  );
}
