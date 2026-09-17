import { Dispatch, FormEvent, SetStateAction, useMemo, useRef, useState } from "react";

import styles from "./DocumentsStep.module.css";

export type DocumentDraft = {
  clientId: string;
  file: File;
  category: string;
  folder: string;
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
  error: string;
};

export default function DocumentsStep({ documents, setDocuments, onBack, onSubmit, error }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [selectedFolder, setSelectedFolder] = useState("ALL");
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [newFolder, setNewFolder] = useState("");
  const folders = useMemo(() => [...categories.map(([value, label]) => ({ value, label })), ...customFolders.map((label) => ({ value: `CUSTOM:${label}`, label }))], [customFolders]);
  const visibleDocuments = selectedFolder === "ALL" ? documents : documents.filter((item) => item.folder === selectedFolder);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const accepted = Array.from(files).filter((file) => file.size > 0 && file.size <= 20 * 1024 * 1024 && ["application/pdf", "image/jpeg", "image/png"].includes(file.type));
    setDocuments((current) => [...current, ...accepted.map((file) => ({ clientId: crypto.randomUUID(), file, category: selectedFolder !== "ALL" && !selectedFolder.startsWith("CUSTOM:") ? selectedFolder : "DIGER", folder: selectedFolder === "ALL" ? "DIGER" : selectedFolder }))]);
    if (input.current) input.current.value = "";
  }

  return <form className={styles.form} onSubmit={onSubmit}>
    {error && <p className={styles.error}>{error}</p>}
    <header className={styles.heading}><div><h2>▣ Evraklar</h2><p>Dosyaları klasörlere ayırın; sürükleyerek farklı klasöre taşıyın.</p></div><label className={styles.upload}><input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={(event) => addFiles(event.target.files)} />+ Evrak Yükle</label></header>
    <div className={styles.workspace}><aside><header><b>Klasörler</b></header><button type="button" className={selectedFolder === "ALL" ? styles.activeFolder : ""} onClick={() => setSelectedFolder("ALL")} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveDocument(event, "DIGER", setDocuments)}>▣ Tüm Evraklar <span>{documents.length}</span></button>{folders.map((folder) => <button type="button" key={folder.value} className={selectedFolder === folder.value ? styles.activeFolder : ""} onClick={() => setSelectedFolder(folder.value)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveDocument(event, folder.value, setDocuments)}>▰ {folder.label}<span>{documents.filter((item) => item.folder === folder.value).length}</span></button>)}<div className={styles.newFolder}><input maxLength={60} value={newFolder} onChange={(event) => setNewFolder(event.target.value)} placeholder="Yeni klasör" /><button type="button" onClick={() => { const name = newFolder.trim(); if (!name || customFolders.includes(name)) return; setCustomFolders((current) => [...current, name]); setSelectedFolder(`CUSTOM:${name}`); setNewFolder(""); }}>+</button></div></aside><section className={styles.documentArea}><div className={styles.filters}><input placeholder="Evrak adına göre ara" readOnly value="" /><span>{visibleDocuments.length} evrak gösteriliyor</span></div>
    <label className={styles.dropzone}>
      <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={(event) => addFiles(event.target.files)} />
      <b>Dosyaları buraya bırakın veya seçin</b><span>PDF, JPG veya PNG · Her dosya en fazla 20 MB</span>
    </label>
    {visibleDocuments.length === 0 ? <section className={styles.empty}><b>Bu klasörde evrak yok</b><span>Evrak yükleyebilir veya başka klasörden buraya sürükleyebilirsiniz.</span></section> : <section className={styles.list}>
      {visibleDocuments.map((document) => <article draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", document.clientId)} key={document.clientId}>
        <div className={styles.icon}>{document.file.type === "application/pdf" ? "PDF" : "IMG"}</div>
        <div className={styles.name}><b>{document.file.name}</b><span>{formatSize(document.file.size)}</span></div>
        <label><span>Klasör / Kategori</span><select value={document.folder} onChange={(event) => setDocuments((current) => current.map((item) => item.clientId === document.clientId ? { ...item, folder: event.target.value, category: event.target.value.startsWith("CUSTOM:") ? "DIGER" : event.target.value } : item))}>{folders.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}</select></label>
        <button type="button" onClick={() => setDocuments((current) => current.filter((item) => item.clientId !== document.clientId))}>Kaldır</button>
      </article>)}
    </section>}</section></div>
    <footer><button type="button" className={styles.back} onClick={onBack}>← Dava Süreci</button><span>5 / 7 · Evraklar</span><button type="submit">Görevlere İlerle →</button></footer>
  </form>;
}

function moveDocument(event: React.DragEvent, folder: string, setDocuments: Dispatch<SetStateAction<DocumentDraft[]>>) {
  const clientId = event.dataTransfer.getData("text/plain"); if (!clientId) return;
  setDocuments((current) => current.map((item) => item.clientId === clientId ? { ...item, folder, category: folder.startsWith("CUSTOM:") ? "DIGER" : folder } : item));
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB` : `${Math.ceil(bytes / 1024)} KB`;
}
