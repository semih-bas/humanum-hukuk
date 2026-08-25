"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import AppShell from "@/components/app-shell/AppShell";
import styles from "./page.module.css";

type Operation = "note" | "document" | "reminder" | null;

function Icon({ name }: { name: "bell" | "check" | "document" | "note" | "x" }) {
  const paths = {
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    document: <><path d="M6 3h9l3 3v15H6Z" /><path d="M14 3v4h4M9 12h6M9 16h4" /></>,
    note: <><path d="M4 4h12v16H4Z" /><path d="m14 4 4 4M8 9h5M8 13h5" /></>,
    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function AmountInput({ label, value, onChange, readOnly = false }: { label: string; value: number; onChange?: (value: number) => void; readOnly?: boolean }) {
  return <label className={styles.field}><span>{label}</span><div className={`${styles.amountInput} ${readOnly ? styles.readOnly : ""}`}><input type="number" min="0" step="0.01" value={value || ""} placeholder="0,00" readOnly={readOnly} onChange={(event) => onChange?.(Math.max(0, Number(event.target.value)))} /><b>TL</b></div></label>;
}

export default function NewCasePage() {
  const [damage, setDamage] = useState(0);
  const [depreciation, setDepreciation] = useState(0);
  const [profitLoss, setProfitLoss] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentCount, setInstallmentCount] = useState<3 | 4>(3);
  const [operation, setOperation] = useState<Operation>(null);
  const [notice, setNotice] = useState("");

  const totalClaim = useMemo(() => damage + depreciation + profitLoss, [damage, depreciation, profitLoss]);
  const netClaim = Math.max(0, totalClaim - discount);
  const monthlyInstallment = installmentEnabled ? netClaim / installmentCount : 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
    setNotice("Form doğrulandı. Kalıcı kayıt işlemi güvenli backend bağlantısıyla etkinleştirilecek.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <AppShell hideTopbar>
    <form className={styles.newCasePage} onSubmit={handleSubmit}>
      <header className={styles.pageHeader}>
        <div className={styles.pageTitle}><h1>Yeni Dosya Ekle</h1><p><Link href="/dashboard">Ana Sayfa</Link><span>›</span><Link href="/dosyalarim">Dosyalarım</Link><span>›</span><b>Yeni Dosya Ekle</b></p></div>
        <p className={styles.pageDescription}>Dosya bilgilerini eksiksiz girerek kaydediniz.</p>
        <div className={styles.pageActions}><Link href="/dosyalarim"><Icon name="x" />Vazgeç</Link><button type="submit"><Icon name="check" />Kaydet</button></div>
      </header>
      {notice && <p className={styles.notice} role="status">{notice}<button type="button" aria-label="Bildirimi kapat" onClick={() => setNotice("")}><Icon name="x" /></button></p>}

      <section className={styles.sectionCard}>
        <h2><span>1</span>Araç ve Taraf Bilgileri</h2>
        <div className={styles.fourColumns}>
          <label className={styles.field}><span>Ruhsat Sahibi</span><input required placeholder="Ruhsat sahibi adı soyadı" /></label>
          <label className={styles.field}><span>Araç Plakası</span><input required placeholder="34 ABC 123" /></label>
          <label className={styles.field}><span>Kaza Tarihi</span><input required type="date" /></label>
          <label className={styles.field}><span>Borçlu Taraf</span><select required defaultValue=""><option value="" disabled>Borçlu tarafı seçiniz</option><option>Sigorta Şirketi</option><option>Şahıs</option><option>Şirket</option></select></label>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <h2><span>2</span>Hesaplanan Tutarlar</h2>
        <div className={styles.fourColumns}><AmountInput label="Hesaplanan Hasar Bedeli Tutarı" value={damage} onChange={setDamage} /><AmountInput label="Hesaplanan Değer Kaybı Tutarı" value={depreciation} onChange={setDepreciation} /><AmountInput label="Hesaplanan Kazanç Kaybı Tutarı" value={profitLoss} onChange={setProfitLoss} /><AmountInput label="Talep Edilen Toplam Tutar" value={totalClaim} readOnly /></div>
      </section>

      <div className={styles.splitGrid}>
        <section className={styles.sectionCard}><h2><span>3</span>İcra Bilgileri</h2><div className={styles.twoColumns}><label className={styles.field}><span>İcra Dairesi / İcra Numarası</span><input placeholder="Örn: İstanbul 12. İcra Dairesi / 2024/12345" /></label><AmountInput label="Toplam Dosya Hesabı" value={totalClaim} readOnly /></div></section>
        <section className={styles.sectionCard}><h2><span>4</span>Finansal Bilgiler</h2><div className={styles.twoColumns}><AmountInput label="İndirim Tutarı" value={discount} onChange={setDiscount} /><AmountInput label="Net Talep Tutarı" value={netClaim} readOnly /></div></section>
      </div>

      <div className={styles.splitGrid}>
        <section className={styles.sectionCard}><h2><span>5</span>Haciz Bilgileri</h2><div className={styles.toggleGrid}>{["Araç Haczi", "Banka Haczi", "Tapu Haczi"].map((label) => <label className={styles.toggle} key={label}><span>{label}</span><input type="checkbox" /><i /><small>Hayır / Evet</small></label>)}</div></section>
        <section className={styles.sectionCard}><h2><span>6</span>Taksit Bilgileri</h2><div className={styles.threeColumns}><label className={styles.field}><span>Taksit Durumu</span><select value={installmentEnabled ? "yes" : "no"} onChange={(event) => setInstallmentEnabled(event.target.value === "yes")}><option value="no">Taksit Yok</option><option value="yes">Taksitli Ödeme</option></select></label><label className={styles.field}><span>Taksit Sayısı</span><select disabled={!installmentEnabled} value={installmentCount} onChange={(event) => setInstallmentCount(Number(event.target.value) as 3 | 4)}><option value="3">3 Ay</option><option value="4">4 Ay</option></select></label><AmountInput label="Aylık Taksit Tutarı" value={monthlyInstallment} readOnly /></div></section>
      </div>

      <div className={styles.splitGrid}>
        <section className={styles.sectionCard}><h2><span>7</span>Dosya Durumu</h2><label className={styles.field}><span>Dosya Durumu</span><select required defaultValue=""><option value="" disabled>Dosya durumunu seçiniz</option><option>Devam Ediyor</option><option>İcra Takibinde</option><option>Taksitli Ödeme</option><option>Beklemede</option><option>Sonuçlandı</option></select></label><p className={styles.hint}>Dosya durumunu doğru seçmek, süreç takibi açısından önemlidir.</p></section>
        <section className={styles.sectionCard}><h2><span>8</span>Dosya İşlemleri</h2><div className={styles.operationGrid}><button type="button" onClick={() => setOperation("note")}><Icon name="note" /><span>Not Ekle</span></button><button type="button" onClick={() => setOperation("document")}><Icon name="document" /><span>Evrak Ekle</span></button><button type="button" onClick={() => setOperation("reminder")}><Icon name="bell" /><span>Hatırlatma Ekle</span></button></div></section>
      </div>

    </form>

    {operation && <div className={styles.modalBackdrop} onMouseDown={() => setOperation(null)}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="operation-title" onMouseDown={(event) => event.stopPropagation()}><header><h2 id="operation-title">{operation === "note" ? "Not Ekle" : operation === "document" ? "Evrak Ekle" : "Hatırlatma Ekle"}</h2><button type="button" aria-label="Pencereyi kapat" onClick={() => setOperation(null)}><Icon name="x" /></button></header><div className={styles.modalBody}>{operation === "note" && <label className={styles.field}><span>Dosya Notu</span><textarea rows={6} placeholder="Dosyayla ilgili notunuzu yazın..." /></label>}{operation === "document" && <label className={styles.uploadField}><Icon name="document" /><span>Yüklenecek evrakı seçin</span><small>PDF, JPG veya PNG</small><input type="file" accept=".pdf,.jpg,.jpeg,.png" /></label>}{operation === "reminder" && <><label className={styles.field}><span>Hatırlatma Başlığı</span><input placeholder="Örn: Duruşma tarihi" /></label><label className={styles.field}><span>Tarih ve Saat</span><input type="datetime-local" /></label><div className={styles.channels}><label><input type="checkbox" defaultChecked /> E-posta</label><label><input type="checkbox" defaultChecked /> SMS</label></div></>}</div><footer><button type="button" onClick={() => setOperation(null)}>Vazgeç</button><button type="button" onClick={() => { setOperation(null); setNotice("Dosya işlemi forma eklendi; kalıcı kayıt backend aşamasında yapılacak."); }}>Forma Ekle</button></footer></section></div>}
  </AppShell>;
}
