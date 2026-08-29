"use client";

import { FormEvent, useState } from "react";

import PasswordRecoveryCard from "@/components/password-recovery/PasswordRecoveryCard";
import { authClient } from "@/lib/auth-client";
import styles from "./page.module.css";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/sifre-sifirla`,
      });
      if (error?.status === 429) {
        setNotice({ tone: "error", message: "Çok fazla yenileme talebi gönderildi. Lütfen birkaç dakika sonra tekrar deneyin." });
        return;
      }
      if (error) throw new Error("Password reset request failed");
      setNotice({ tone: "success", message: "Bu e-posta sistemde kayıtlıysa şifre yenileme bağlantısı gönderildi. Gelen kutunuzu ve gereksiz klasörünü kontrol edin." });
    } catch {
      setNotice({ tone: "error", message: "Şifre yenileme servisine şu anda ulaşılamıyor. Lütfen tekrar deneyin." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return <PasswordRecoveryCard eyebrow="Hesap kurtarma" title="Şifrenizi yenileyin" description="Hesabınıza bağlı e-posta adresini yazın. Kayıtlıysa 30 dakika geçerli güvenli bir bağlantı göndereceğiz.">
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label><span>E-posta adresi</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ornek@humanum.com" disabled={isSubmitting} /></label>
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Gönderiliyor..." : "Yenileme bağlantısı gönder"}</button>
      {notice && <p className={`${styles.notice} ${notice.tone === "error" ? styles.noticeError : ""}`} role="status" aria-live="polite">{notice.message}</p>}
    </form>
  </PasswordRecoveryCard>;
}
