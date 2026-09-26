"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatDate, INSURANCE_CASE_TYPE_LABELS, INSURANCE_STATUS_LABELS, type InsuranceCaseType, type InsuranceStatus } from "@/lib/insurance-arbitration/presentation";
import styles from "./page.module.css";

type Detail = {
  referenceNumber: string; arbitrationApplicationNo: string | null; opposingInsuranceCompany: string; opposingPolicyNumber: string | null; policyExpiryDate: string | null;
  opposingVehicleOwner: string | null; opposingIdentityNumber: string | null; vehicleOwner: string; identityNumber: string | null; vehiclePlate: string; accidentDate: string;
  postalDeliveryDate: string | null; caseTypes: InsuranceCaseType[]; insuranceApplicationDate: string | null; insuranceSettlementOffer: string;
  arbitrationApplicationDate: string | null; hasArbitration: boolean; arbitrationCaseNumber: string | null; status: InsuranceStatus;
  postageExpense: string; enforcementExpense: string; arbitrationApplicationFee: string; expertFee: string; postalAmount: string; actualDepreciationAmount: string;
  description: string | null; createdAt: string; updatedAt: string;
  payments: Array<{ id: string; type: string; paymentDate: string; amount: string; commission: string; clientAmount: string; description: string | null }>;
  notes: Array<{ id: string; content: string; createdAt: string; author: { name: string } }>;
  notifications: Array<{ id: string; title: string; eventAt: string; status: string; creator: { name: string } }>;
  documents: Array<{ id: string; originalName: string; sizeBytes: number; createdAt: string }>;
};

const paymentLabels: Record<string, string> = { OUTGOING_PAYMENT: "Giden Ödeme", INSURANCE_INCOME: "Sigorta Tahsilatı", ARBITRATION_INCOME: "Tahkim Tahsilatı", ENFORCEMENT_INCOME: "İcra Tahsilatı" };

export default function InsuranceCaseDetailModal({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/insurance-arbitration/${encodeURIComponent(caseId)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Dosya ayrıntıları yüklenemedi."); return body.data as Detail; })
      .then(setDetail)
      .catch((cause: unknown) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Dosya ayrıntıları yüklenemedi."); });
    return () => controller.abort();
  }, [caseId]);

  return createPortal(<div className={styles.detailBackdrop} role="presentation" onMouseDown={onClose}>
    <section className={styles.detailModal} role="dialog" aria-modal="true" aria-labelledby="insurance-detail-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span>{detail?.referenceNumber ?? "Sigorta ve Tahkim"}</span><h2 id="insurance-detail-title">{detail?.vehiclePlate ?? (error ? "Dosya açılamadı" : "Yükleniyor…")}</h2></div><button type="button" aria-label="Dosya ayrıntısını kapat" onClick={onClose}>×</button></header>
      {error && <p className={styles.detailError}>{error}</p>}
      {!detail && !error && <p className={styles.detailLoading}>Dosya ayrıntıları yükleniyor…</p>}
      {detail && <div className={styles.detailScroll}>
        <section className={styles.detailHero}>
          <div><span>Müvekkil</span><strong>{detail.vehicleOwner}</strong><small>{detail.identityNumber || "TC/VKN belirtilmedi"}</small></div>
          <div><span>Dosya Durumu</span><strong>{INSURANCE_STATUS_LABELS[detail.status]}</strong><small>{formatDate(detail.updatedAt.slice(0, 10))} tarihinde güncellendi</small></div>
          <div><span>Gerçek Değer Kaybı</span><strong>{money(detail.actualDepreciationAmount)} TL</strong><small>{detail.caseTypes.map((type) => INSURANCE_CASE_TYPE_LABELS[type]).join(", ")}</small></div>
        </section>
        <Group title="Karşı Taraf Bilgileri"><Item label="Karşı Sigorta" value={detail.opposingInsuranceCompany} /><Item label="Poliçe No" value={detail.opposingPolicyNumber} /><Item label="Poliçe Vadesi" value={formatDate(detail.policyExpiryDate)} /><Item label="Karşı Araç Sahibi" value={detail.opposingVehicleOwner} /><Item label="Karşı TC / VKN" value={detail.opposingIdentityNumber} /></Group>
        <Group title="Araç ve Kaza Bilgileri"><Item label="Araç Sahibi / Müvekkil" value={detail.vehicleOwner} /><Item label="TC / VKN" value={detail.identityNumber} /><Item label="Araç Plaka" value={detail.vehiclePlate} /><Item label="Kaza Tarihi" value={formatDate(detail.accidentDate)} /><Item label="Posta Teslim" value={formatDate(detail.postalDeliveryDate)} /></Group>
        <Group title="Başvuru ve Süreç Bilgileri"><Item label="Dosya Türleri" value={detail.caseTypes.map((type) => INSURANCE_CASE_TYPE_LABELS[type]).join(", ")} /><Item label="Sigorta Başvurusu" value={formatDate(detail.insuranceApplicationDate)} /><Item label="Tahkim Durumu" value={detail.hasArbitration ? "Var" : "Yok"} /><Item label="Tahkim Başvurusu" value={formatDate(detail.arbitrationApplicationDate)} /><Item label="Tahkim Başvuru No" value={detail.arbitrationApplicationNo} /><Item label="Tahkim Esas No" value={detail.arbitrationCaseNumber} /></Group>
        <Group title="Tutar ve Masraf Bilgileri"><Item label="Sigorta Sulh Teklifi" value={money(detail.insuranceSettlementOffer) + " TL"} /><Item label="Pul Gideri" value={money(detail.postageExpense) + " TL"} /><Item label="İcra Masrafı" value={money(detail.enforcementExpense) + " TL"} /><Item label="Tahkim Başvuru Ücreti" value={money(detail.arbitrationApplicationFee) + " TL"} /><Item label="Bilirkişi Ücreti" value={money(detail.expertFee) + " TL"} /><Item label="Posta Rakamı" value={money(detail.postalAmount) + " TL"} /></Group>
        {detail.description && <section className={styles.detailSection}><h3>Açıklama</h3><p>{detail.description}</p></section>}
        <section className={styles.detailSection}><h3>Ödemeler ({detail.payments.length})</h3>{detail.payments.length ? detail.payments.map((payment) => <article key={payment.id}><b>{paymentLabels[payment.type] ?? payment.type}</b><span>{formatDate(payment.paymentDate)} · {money(payment.amount)} TL</span><small>{payment.description || `Komisyon: ${money(payment.commission)} TL · Müvekkil: ${money(payment.clientAmount)} TL`}</small></article>) : <p>Henüz ödeme kaydı yok.</p>}</section>
        <section className={styles.detailSection}><h3>Notlar ({detail.notes.length})</h3>{detail.notes.length ? detail.notes.map((note) => <article key={note.id}><b>{note.author.name}</b><span>{dateTime(note.createdAt)}</span><small>{note.content}</small></article>) : <p>Henüz not yok.</p>}</section>
        <section className={styles.detailSection}><h3>Bildirimler ({detail.notifications.length})</h3>{detail.notifications.length ? detail.notifications.map((item) => <article key={item.id}><b>{item.title}</b><span>{dateTime(item.eventAt)} · {notificationStatus(item.status)}</span><small>Oluşturan: {item.creator.name}</small></article>) : <p>Henüz bildirim yok.</p>}</section>
        <section className={styles.detailSection}><h3>Belgeler ({detail.documents.length})</h3>{detail.documents.length ? detail.documents.map((document) => <article key={document.id}><a href={`/api/insurance-arbitration/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(document.id)}`}>{document.originalName}</a><span>{bytes(document.sizeBytes)} · {dateTime(document.createdAt)}</span></article>) : <p>Henüz belge yok.</p>}</section>
        <section className={styles.detailSection}><h3>Kayıt Bilgileri</h3><article><b>Oluşturulma</b><span>{dateTime(detail.createdAt)}</span></article><article><b>Son Güncelleme</b><span>{dateTime(detail.updatedAt)}</span></article></section>
      </div>}
    </section>
  </div>, document.body);
}

function Group({ title, children }: { title: string; children: React.ReactNode }) { return <section className={styles.detailGroup}><h3>{title}</h3><dl>{children}</dl></section>; }
function Item({ label, value }: { label: string; value: string | null }) { return <div><dt>{label}</dt><dd>{value || "—"}</dd></div>; }
function money(value: string) { return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0)); }
function dateTime(value: string) { return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function bytes(value: number) { return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`; }
function notificationStatus(value: string) { return value === "SENT" ? "Gönderildi" : value === "FAILED" ? "Gönderilemedi" : value === "PARTIALLY_SENT" ? "Kısmen gönderildi" : "Bekliyor"; }
