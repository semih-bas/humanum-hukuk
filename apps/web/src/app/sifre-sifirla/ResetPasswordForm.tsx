"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

import PasswordRecoveryCard from "@/components/password-recovery/PasswordRecoveryCard";
import { authClient } from "@/lib/auth-client";
import styles from "./page.module.css";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const invalidToken = !token || searchParams.get("error") === "INVALID_TOKEN";
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const formData = new FormData(form);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      setNotice("Yeni şifre alanları eşleşmiyor.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await authClient.resetPassword({ newPassword, token });
      if (error) {
        setNotice(error.status === 429 ? "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin." : "Bu bağlantı geçersiz, süresi dolmuş veya daha önce kullanılmış.");
        return;
      }
      form.reset();
      setIsComplete(true);
    } catch {
      setNotice("Şifre yenileme servisine şu anda ulaşılamıyor. Lütfen tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <PasswordRecoveryCard eyebrow="Hesap güvenliği" title="Yeni şifre belirleyin" description="Yeni şifreniz 10–128 karakter arasında olmalıdır. Başka hesaplarda kullandığınız bir şifreyi tekrar kullanmayın.">
    {isComplete ? <div className={styles.success}><b>Şifreniz yenilendi</b><span>Artık yeni şifrenizle giriş yapabilirsiniz.</span><a href="/login">Giriş ekranına git</a></div> : invalidToken ? <div className={styles.invalid}><b>Bağlantı geçersiz</b><span>Bağlantının süresi dolmuş veya daha önce kullanılmış olabilir.</span><a href="/sifremi-unuttum">Yeni bağlantı iste</a></div> : <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label><span>Yeni şifre</span><input name="newPassword" type="password" minLength={10} maxLength={128} autoComplete="new-password" required disabled={isSubmitting} /></label>
      <label><span>Yeni şifre tekrarı</span><input name="confirmation" type="password" minLength={10} maxLength={128} autoComplete="new-password" required disabled={isSubmitting} /></label>
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Kaydediliyor..." : "Şifreyi yenile"}</button>
      {notice && <p className={styles.notice} role="alert">{notice}</p>}
    </form>}
  </PasswordRecoveryCard>;
}
