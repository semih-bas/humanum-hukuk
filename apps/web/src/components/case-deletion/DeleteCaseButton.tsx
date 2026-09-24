"use client";

import { useState } from "react";
import styles from "./DeleteCaseButton.module.css";

export default function DeleteCaseButton({ endpoint, reference, onDeleted }: { endpoint: string; reference: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function remove() {
    if (busy) return; setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "DELETE", credentials: "same-origin" });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Dosya silinemedi.");
      setOpen(false); onDeleted();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dosya silinemedi."); }
    finally { setBusy(false); }
  }
  return <><button className={styles.trigger} type="button" title="Sil" aria-label={`${reference} dosyasını sil`} onClick={() => { setError(""); setOpen(true); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg></button>{open && <div className={styles.backdrop} role="presentation" onMouseDown={() => { if (!busy) setOpen(false); }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={`delete-${reference}`} onMouseDown={(event) => event.stopPropagation()}><span className={styles.icon}>!</span><h2 id={`delete-${reference}`}>Dosya silinsin mi?</h2><p><strong>{reference}</strong> listeden hemen kaldırılacak. Dosya 30 gün boyunca geri getirilebilir; ardından sistem tarafından kalıcı olarak temizlenir.</p>{error && <div className={styles.error}>{error}</div>}<footer><button type="button" onClick={() => setOpen(false)} disabled={busy}>Vazgeç</button><button type="button" className={styles.confirm} onClick={() => void remove()} disabled={busy}>{busy ? "Siliniyor…" : "Eminim, sil"}</button></footer></section></div>}</>;
}
