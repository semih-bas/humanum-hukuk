"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./page.module.css";

export default function ChangePasswordForm({ requiredChange }: { requiredChange: boolean }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const newPasswordConfirmation = String(formData.get("newPasswordConfirmation") ?? "");
    if (newPassword !== newPasswordConfirmation) {
      setNotice("Yeni şifre alanları eşleşmiyor.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ currentPassword, newPassword, newPasswordConfirmation }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) {
        setNotice(result.error?.message ?? "Şifre değiştirilemedi. Lütfen tekrar deneyin.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setNotice("Şifre değiştirilemedi. Lütfen tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <p className={styles.eyebrow}>Hesap güvenliği</p>
        <h1>{requiredChange ? "Şifrenizi belirleyin" : "Şifrenizi değiştirin"}</h1>
        <p className={styles.description}>{requiredChange ? "İlk girişiniz tamamlanmadan önce kişisel şifrenizi oluşturun." : "Hesabınızın güvenliği için mevcut şifrenizi doğrulayarak yeni bir şifre belirleyin."}</p>
        <label><span>{requiredChange ? "Mevcut geçici şifre" : "Mevcut şifre"}</span><input name="currentPassword" type="password" autoComplete="current-password" required disabled={isSubmitting} /></label>
        <label><span>Yeni şifre</span><input name="newPassword" type="password" minLength={10} maxLength={128} autoComplete="new-password" required disabled={isSubmitting} /></label>
        <label><span>Yeni şifre tekrarı</span><input name="newPasswordConfirmation" type="password" minLength={10} maxLength={128} autoComplete="new-password" required disabled={isSubmitting} /></label>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Kaydediliyor..." : requiredChange ? "Şifreyi belirle" : "Şifreyi değiştir"}</button>
        {!requiredChange && <button className={styles.secondaryButton} type="button" disabled={isSubmitting} onClick={() => router.back()}>Vazgeç</button>}
        <p className={styles.notice} role="alert">{notice}</p>
      </form>
    </main>
  );
}
