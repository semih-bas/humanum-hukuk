import { Dispatch, FormEvent, SetStateAction, useMemo, useRef, useState } from "react";

import styles from "./DocumentsStep.module.css";

export type DocumentDraft = {
  clientId: string;
  file: File | null;
  persistedId?: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  folder: string;
};
export type DocumentFolderConfig = { key: string; label: string; hidden: boolean };

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
  caseId?: string;
  folderConfig: DocumentFolderConfig[];
  setFolderConfig: Dispatch<SetStateAction<DocumentFolderConfig[]>>;
};

export default function DocumentsStep({ documents, setDocuments, onBack, onSubmit, error, caseId, folderConfig, setFolderConfig }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const uploadFolder = useRef("DIGER");
  const [selectedFolder, setSelectedFolder] = useState("ALL");
  const [newFolder, setNewFolder] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [documentError, setDocumentError] = useState("");
  const folders = useMemo(() => [...categories.map(([value, label]) => ({ value, label })), ...folderConfig.filter((folder) => folder.key.startsWith("CUSTOM:")).map((folder) => ({ value: folder.key, label: folder.label }))].filter((folder) => !folderConfig.some((item) => item.key === folder.value && item.hidden)), [folderConfig]);
  const visibleDocuments = (selectedFolder === "ALL" ? documents : documents.filter((item) => item.folder === selectedFolder))
    .filter((item) => item.originalName.toLocaleLowerCase("tr-TR").includes(search.trim().toLocaleLowerCase("tr-TR")));

  function addFiles(files: FileList | null) {
    if (!files) return;
    const accepted = Array.from(files).filter((file) => file.size > 0 && file.size <= 20 * 1024 * 1024 && ["application/pdf", "image/jpeg", "image/png"].includes(file.type));
    const folder = uploadFolder.current;
    setDocuments((current) => [...current, ...accepted.map((file) => ({ clientId: crypto.randomUUID(), file, originalName: file.name, mimeType: file.type, sizeBytes: file.size, category: folder.startsWith("CUSTOM:") ? "DIGER" : folder, folder }))]);
    if (input.current) input.current.value = "";
  }
  function chooseFiles(folder = selectedFolder === "ALL" ? "DIGER" : selectedFolder) { uploadFolder.current = folder; input.current?.click(); }
  function toggleFolder(folder: string) { setExpandedFolders((current) => current.includes(folder) ? current.filter((item) => item !== folder) : [...current, folder]); }
  function removeFolder(folder: string) {
    setDocuments((current) => current.map((item) => item.folder === folder ? { ...item, folder: "DIGER", category: "DIGER" } : item));
    setFolderConfig((current) => folder.startsWith("CUSTOM:") ? current.filter((item) => item.key !== folder) : [...current.filter((item) => item.key !== folder), { key: folder, label: categories.find(([key]) => key === folder)?.[1] ?? folder, hidden: true }]);
    void Promise.all(documents.filter((item) => item.folder === folder && item.persistedId && caseId).map((item) => persistMove(caseId!, item.persistedId!, "DIGER"))).catch(() => setDocumentError("Evraklardan biri Diğer Evraklar klasörüne taşınamadı."));
    setExpandedFolders((current) => current.filter((item) => item !== folder));
    if (selectedFolder === folder) setSelectedFolder("DIGER");
  }
  async function removeDocument(document: DocumentDraft) {
    if (document.persistedId && caseId) {
      if (!window.confirm(`“${document.originalName}” evrakını dosyadan kaldırmak istiyor musunuz?`)) return;
      setDocumentError("");
      const response = await fetch(`/api/general-legal-cases/${caseId}/documents/${document.persistedId}`, { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) { const body = await response.json().catch(() => null); setDocumentError(body?.error?.message ?? "Evrak kaldırılamadı."); return; }
    }
    setDocuments((current) => current.filter((item) => item.clientId !== document.clientId));
  }

  return <form className={styles.form} onSubmit={onSubmit}>
    {(error || documentError) && <p className={styles.error}>{error || documentError}</p>}
    <input ref={input} className={styles.fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={(event) => addFiles(event.target.files)} />
    <header className={styles.heading}><div><h2>▣ Evraklar</h2><p>Dosyaları klasörlere ayırın; sürükleyerek farklı klasöre taşıyın.</p></div><button type="button" className={styles.upload} onClick={() => chooseFiles()}>+ Evrak Yükle</button></header>
    <div className={styles.workspace}><aside><header><b>Klasörler</b></header><button type="button" className={selectedFolder === "ALL" ? styles.activeFolder : ""} onClick={() => setSelectedFolder("ALL")} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveDocument(event, "DIGER", documents, setDocuments, caseId)}>▣ Tüm Evraklar <span>{documents.length}</span></button>{folders.map((folder) => {
      const folderDocuments = documents.filter((item) => item.folder === folder.value);
      const expanded = expandedFolders.includes(folder.value);
      return <div className={styles.folderGroup} key={folder.value}><div className={`${styles.folderRow} ${selectedFolder === folder.value ? styles.activeFolder : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveDocument(event, folder.value, documents, setDocuments, caseId)}><button type="button" className={styles.chevron} aria-label={`${folder.label} içeriğini ${expanded ? "daralt" : "aç"}`} onClick={() => toggleFolder(folder.value)}>{expanded ? "⌄" : "›"}</button><button type="button" className={styles.folderName} onClick={() => setSelectedFolder(folder.value)}>▰ {folder.label}<span>{folderDocuments.length}</span></button><button type="button" className={styles.folderAdd} title="Bu klasöre evrak ekle" aria-label={`${folder.label} klasörüne evrak ekle`} onClick={() => chooseFiles(folder.value)}>＋</button>{folder.value !== "DIGER" && <button type="button" className={styles.folderDelete} title="Klasörü kaldır" aria-label={`${folder.label} klasörünü kaldır`} onClick={() => removeFolder(folder.value)}><TrashIcon /></button>}</div>{expanded && <div className={styles.folderChildren}>{folderDocuments.length ? folderDocuments.map((item) => <button type="button" key={item.clientId} title={item.originalName} onClick={() => setSelectedFolder(folder.value)}>↳ {item.originalName}</button>) : <span>Bu klasör boş</span>}</div>}</div>;
    })}<div className={styles.newFolder}><input maxLength={60} value={newFolder} onChange={(event) => setNewFolder(event.target.value)} placeholder="Yeni klasör" /><button type="button" title="Klasör oluştur" onClick={() => { const name = newFolder.trim(); if (!name || folderConfig.some((item) => item.label.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) return; const key = `CUSTOM:${crypto.randomUUID()}`; setFolderConfig((current) => [...current, { key, label: name, hidden: false }]); setSelectedFolder(key); setExpandedFolders((current) => [...current, key]); setNewFolder(""); }}>+</button></div></aside><section className={styles.documentArea}><div className={styles.filters}><input placeholder="Evrak adına göre ara" value={search} onChange={(event) => setSearch(event.target.value)} /><span>{visibleDocuments.length} evrak gösteriliyor</span></div>
    <button type="button" className={styles.dropzone} onClick={() => chooseFiles()}>
      <b>Dosyaları buraya bırakın veya seçin</b><span>PDF, JPG veya PNG · Her dosya en fazla 20 MB</span>
    </button>
    {visibleDocuments.length === 0 ? <section className={styles.empty}><b>Bu klasörde evrak yok</b><span>Evrak yükleyebilir veya başka klasörden buraya sürükleyebilirsiniz.</span></section> : <section className={styles.list}>
      {visibleDocuments.map((document) => <article draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", document.clientId)} key={document.clientId}>
        <div className={styles.icon}>{document.mimeType === "application/pdf" ? "PDF" : "IMG"}</div>
        <div className={styles.name}><b>{document.originalName}</b><span>{formatSize(document.sizeBytes)}{document.persistedId ? " · Kayıtlı" : " · Yeni"}</span></div>
        <label><span>Klasör / Kategori</span><select value={document.folder} onChange={(event) => { const folder = event.target.value; setDocuments((current) => current.map((item) => item.clientId === document.clientId ? { ...item, folder, category: folder.startsWith("CUSTOM:") ? "DIGER" : folder } : item)); if (document.persistedId && caseId) void persistMove(caseId, document.persistedId, folder).catch(() => setDocumentError("Evrak yeni klasörüne taşınamadı.")); }}>{folders.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}</select></label>
        <button type="button" onClick={() => void removeDocument(document)}>{document.persistedId ? "Sil" : "Kaldır"}</button>
      </article>)}
    </section>}</section></div>
    <footer><button type="button" className={styles.back} onClick={onBack}>← Dava Süreci</button><span>5 / 7 · Evraklar</span><button type="submit">Görevlere İlerle →</button></footer>
  </form>;
}

function moveDocument(event: React.DragEvent, folder: string, documents: DocumentDraft[], setDocuments: Dispatch<SetStateAction<DocumentDraft[]>>, caseId?: string) {
  const clientId = event.dataTransfer.getData("text/plain"); if (!clientId) return;
  const persistedId = documents.find((item) => item.clientId === clientId)?.persistedId;
  setDocuments((current) => current.map((item) => item.clientId === clientId ? { ...item, folder, category: folder.startsWith("CUSTOM:") ? "DIGER" : folder } : item));
  if (persistedId && caseId) void persistMove(caseId, persistedId, folder);
}

async function persistMove(caseId: string, documentId: string, folderKey: string) {
  const response = await fetch(`/api/general-legal-cases/${caseId}/documents/${documentId}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderKey }) });
  if (!response.ok) throw new Error("Document move failed");
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function TrashIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="m6.5 7 1 13h9l1-13" /><path d="M10 11v5M14 11v5" /></svg>;
}
