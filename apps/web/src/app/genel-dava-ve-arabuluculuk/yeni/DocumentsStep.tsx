import { Dispatch, FormEvent, SetStateAction, useRef } from "react";

import styles from "./DocumentsStep.module.css";

export type DocumentDraft = {
  clientId: string;
  file: File;
  category: string;
};

const categories = [
  ["DAVA_DILEKCESI", "Dava Dilekçesi"], ["CEVAP_DILEKCESI", "Cevap Dilekçesi"],
  ["REPLIK_DUPLIK", "Replik / Düplik"], ["DELIL", "Deliller"], ["BILIRKISI_RAPORU", "Bilirkişi Raporları"],
  ["DURUSMA_TUTANAGI", "Duruşma Tutanakları"], ["ARA_KARAR", "Ara Kararlar"], ["TEBLIGAT", "Tebligatlar"],
  ["ISTINAF", "İstinaf"], ["YARGITAY", "Yargıtay"], ["KARAR", "Karar"],
  ["KESINLESME_SERHI", "Kesinleşme Şerhi"], ["GELEN_EVRAK", "Gelen Evrak"],
  ["GIDEN_EVRAK", "Giden Evrak"], ["DIGER", "Diğer Evraklar"],
] as const;

type Props = {
  documents: DocumentDraft[];
  setDocuments: Dispatch<SetStateAction<DocumentDraft[]>>;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  locked: boolean;
  error: string;
};

export default function DocumentsStep({ documents, setDocuments, onBack, onSubmit, saving, locked, error }: Props) {
  const input = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const accepted = Array.from(files).filter((file) => file.size > 0 && file.size <= 20 * 1024 * 1024 && ["application/pdf", "image/jpeg", "image/png"].includes(file.type));
    setDocuments((current) => [...current, ...accepted.map((file) => ({ clientId: crypto.randomUUID(), file, category: "DIGER" }))]);
    if (input.current) input.current.value = "";
  }

  return <form className={styles.form} onSubmit={onSubmit}>
    {error && <p className={styles.error}>{error}</p>}
    <header className={styles.heading}><div><h2>Evraklar</h2><p>Dosyayla birlikte yüklenecek evrakları kategorilerine ayırın.</p></div><span>{documents.length} evrak</span></header>
    <label className={styles.dropzone}>
      <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple disabled={locked} onChange={(event) => addFiles(event.target.files)} />
      <b>+ Evrak Seç</b><span>PDF, JPG veya PNG · Her dosya en fazla 20 MB</span>
    </label>
    {documents.length === 0 ? <section className={styles.empty}><b>Henüz evrak eklenmedi</b><span>Bu adım zorunlu değildir; evrakları dosya oluşturulduktan sonra da ekleyebilirsiniz.</span></section> : <section className={styles.list}>
      {documents.map((document) => <article key={document.clientId}>
        <div className={styles.icon}>{document.file.type === "application/pdf" ? "PDF" : "IMG"}</div>
        <div className={styles.name}><b>{document.file.name}</b><span>{formatSize(document.file.size)}</span></div>
        <label><span>Kategori</span><select value={document.category} disabled={locked} onChange={(event) => setDocuments((current) => current.map((item) => item.clientId === document.clientId ? { ...item, category: event.target.value } : item))}>{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <button type="button" disabled={locked} onClick={() => setDocuments((current) => current.filter((item) => item.clientId !== document.clientId))}>Kaldır</button>
      </article>)}
    </section>}
    <footer><button type="button" className={styles.back} onClick={onBack} disabled={locked}>← Dava Süreci</button><span>5 / 7 · Evraklar</span><button type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Dosyayı Kaydet"}</button></footer>
  </form>;
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB` : `${Math.ceil(bytes / 1024)} KB`;
}
