import { centsToMoneyString, formatMoneyInput, limitDateYear, parseMoneyToCents } from "@/lib/form-input";
import { Dispatch, FormEvent, SetStateAction, useMemo, useState } from "react";

import styles from "./FinanceStep.module.css";

export type FinanceDraft = {
  claimAmount: string;
  amendmentAmount: string;
  interestRequested: boolean;
  interestStartDate: string;
  expectedCollectionAmount: string;
  opposingAttorneyFee: string;
  paymentPlan: "CASH" | "INSTALLMENT";
  installmentCount: string;
  financeDescription: string;
};

export type FinancialEntryDraft = {
  clientId: string;
  type: "EXPENSE" | "COLLECTION" | "PAYMENT";
  category: string;
  entryDate: string;
  amount: string;
  description: string;
};

type Props = {
  finance: FinanceDraft;
  setFinance: Dispatch<SetStateAction<FinanceDraft>>;
  entries: FinancialEntryDraft[];
  setEntries: Dispatch<SetStateAction<FinancialEntryDraft[]>>;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  error: string;
};

export default function FinanceStep({ finance, setFinance, entries, setEntries, onBack, onSubmit, saving, error }: Props) {
  const [draft, setDraft] = useState<FinancialEntryDraft>(() => emptyEntry());
  const totals = useMemo(() => calculatePreview(finance.expectedCollectionAmount, entries), [finance.expectedCollectionAmount, entries]);

  function update<K extends keyof FinanceDraft>(name: K, value: FinanceDraft[K]) {
    setFinance((current) => ({ ...current, [name]: value }));
  }

  function addEntry() {
    if (!draft.category.trim() || !draft.description.trim() || !draft.entryDate || !parseMoneyToCents(draft.amount)) return;
    setEntries((current) => [...current, { ...draft, category: draft.category.trim(), description: draft.description.trim() }]);
    setDraft(emptyEntry());
  }

  return <form className={styles.form} onSubmit={onSubmit}>
    {error && <p className={styles.error}>{error}</p>}
    <div className={styles.topGrid}>
      <section className={styles.panel}>
        <h2>Dava Değeri ve Talepler</h2>
        <MoneyField label="Talep Tutarı" value={finance.claimAmount} onChange={(value) => update("claimAmount", value)} />
        <MoneyField label="Islah Tutarı" value={finance.amendmentAmount} onChange={(value) => update("amendmentAmount", value)} />
        <label><span>Faiz Talebi</span><select value={finance.interestRequested ? "YES" : "NO"} onChange={(event) => {
          const requested = event.target.value === "YES";
          setFinance((current) => ({ ...current, interestRequested: requested, interestStartDate: requested ? current.interestStartDate : "" }));
        }}><option value="NO">Yok</option><option value="YES">Var</option></select></label>
        {finance.interestRequested && <label><span>Faiz Başlangıç Tarihi *</span><input required type="date" max="9999-12-31" value={finance.interestStartDate} onChange={(event) => update("interestStartDate", limitDateYear(event.target.value, finance.interestStartDate))} /></label>}
      </section>

      <section className={styles.panel}>
        <h2>Tahsilat ve Alacak</h2>
        <MoneyField label="Karşı Taraftan Tahsil Edilecek" value={finance.expectedCollectionAmount} onChange={(value) => update("expectedCollectionAmount", value)} />
        <MoneyField label="Karşı Vekâlet Ücreti" value={finance.opposingAttorneyFee} onChange={(value) => update("opposingAttorneyFee", value)} />
        <div className={styles.result}><span>Tahsil Edilen</span><strong>{totals.collection}</strong></div>
        <div className={`${styles.result} ${styles.remaining}`}><span>Kalan Alacak</span><strong>{totals.remaining}</strong></div>
      </section>

      <section className={styles.panel}>
        <h2>Ödeme Planı</h2>
        <label><span>Plan</span><select value={finance.paymentPlan} onChange={(event) => update("paymentPlan", event.target.value as FinanceDraft["paymentPlan"])}><option value="CASH">Peşin</option><option value="INSTALLMENT">Taksitli</option></select></label>
        {finance.paymentPlan === "INSTALLMENT" && <label><span>Taksit Sayısı *</span><input required type="number" min={2} max={120} value={finance.installmentCount} onChange={(event) => update("installmentCount", event.target.value)} /></label>}
        <label><span>Açıklama</span><textarea maxLength={4000} value={finance.financeDescription} onChange={(event) => update("financeDescription", event.target.value)} placeholder="Tahsilat veya ödeme planıyla ilgili not" /></label>
      </section>
    </div>

    <section className={styles.movements}>
      <header><div><h2>Mali Hareketler</h2><p>Masraf, tahsilat ve ödeme kayıtlarını dosyayla birlikte oluşturun.</p></div><div className={styles.summary}><span>Masraf <b>{totals.expense}</b></span><span>Ödeme <b>{totals.payment}</b></span></div></header>
      <div className={styles.entryForm}>
        <label><span>Tür</span><select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as FinancialEntryDraft["type"] }))}><option value="EXPENSE">Masraf</option><option value="COLLECTION">Tahsilat</option><option value="PAYMENT">Ödeme</option></select></label>
        <label><span>Kategori</span><input maxLength={100} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Örn. Başvuru harcı" /></label>
        <label><span>Tarih</span><input type="date" max="9999-12-31" value={draft.entryDate} onChange={(event) => setDraft((current) => ({ ...current, entryDate: limitDateYear(event.target.value, current.entryDate) }))} /></label>
        <MoneyField label="Tutar" value={draft.amount} onChange={(value) => setDraft((current) => ({ ...current, amount: value }))} />
        <label className={styles.description}><span>Açıklama</span><input maxLength={500} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
        <button type="button" className={styles.add} onClick={addEntry}>+ Hareket Ekle</button>
      </div>
      {entries.length === 0 ? <p className={styles.empty}>Henüz mali hareket eklenmedi. Bu alan zorunlu değildir.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Tür</th><th>Tarih</th><th>Kategori</th><th>Açıklama</th><th>Tutar</th><th></th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.clientId}><td><span className={`${styles.badge} ${styles[entry.type.toLowerCase()]}`}>{entryTypeLabel(entry.type)}</span></td><td>{entry.entryDate}</td><td>{entry.category}</td><td>{entry.description}</td><td>{moneyLabel(entry.amount)}</td><td><button type="button" onClick={() => setEntries((current) => current.filter((item) => item.clientId !== entry.clientId))}>Kaldır</button></td></tr>)}</tbody></table></div>}
    </section>

    <footer><button type="button" className={styles.back} onClick={onBack}>← Taraflar</button><span>3 / 7 · Mali Bilgiler</span><button type="submit" disabled={saving}>Dava Sürecine İlerle →</button></footer>
  </form>;
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span>{label}</span><div className={styles.money}><input inputMode="decimal" value={value} onChange={(event) => onChange(formatMoneyInput(event.target.value))} /><b>TL</b></div></label>;
}

function emptyEntry(): FinancialEntryDraft {
  return { clientId: crypto.randomUUID(), type: "EXPENSE", category: "", entryDate: currentIstanbulDate(), amount: "", description: "" };
}

function calculatePreview(expected: string, entries: FinancialEntryDraft[]) {
  let expense = 0n; let collection = 0n; let payment = 0n;
  for (const entry of entries) {
    const amount = parseMoneyToCents(entry.amount) ?? 0n;
    if (entry.type === "EXPENSE") expense += amount;
    else if (entry.type === "COLLECTION") collection += amount;
    else payment += amount;
  }
  const expectedCents = parseMoneyToCents(expected) ?? 0n;
  const remaining = expectedCents > collection ? expectedCents - collection : 0n;
  return { expense: moneyLabelFromCents(expense), collection: moneyLabelFromCents(collection), payment: moneyLabelFromCents(payment), remaining: moneyLabelFromCents(remaining) };
}

function moneyLabel(value: string) { return moneyLabelFromCents(parseMoneyToCents(value) ?? 0n); }
function moneyLabelFromCents(value: bigint) { return `${centsToMoneyString(value)} TL`; }
function entryTypeLabel(type: FinancialEntryDraft["type"]) { return type === "EXPENSE" ? "Masraf" : type === "COLLECTION" ? "Tahsilat" : "Ödeme"; }
function currentIstanbulDate() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
