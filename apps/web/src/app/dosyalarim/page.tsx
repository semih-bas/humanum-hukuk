"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import AppShell from "@/components/app-shell/AppShell";
import styles from "./page.module.css";

type CaseStatus = "Devam Ediyor" | "İcra Takibinde" | "Taksitli Ödeme" | "Sonuçlandı" | "Beklemede";

type CaseRecord = {
  id: number;
  owner: string;
  plate: string;
  accidentDate: string;
  debtor: string;
  enforcementOffice: string;
  fileNumber: string;
  status: CaseStatus;
};

const caseRecords: CaseRecord[] = [
  { id: 1, owner: "ABC Rent A Car", plate: "34 ABC 123", accidentDate: "12.05.2024", debtor: "XYZ Sigorta A.Ş.", enforcementOffice: "İstanbul 12. İcra Dairesi", fileNumber: "2024/12345", status: "Devam Ediyor" },
  { id: 2, owner: "DEF Turizm Ltd. Şti.", plate: "06 DEF 456", accidentDate: "28.04.2024", debtor: "MNO Sigorta A.Ş.", enforcementOffice: "Ankara 8. İcra Dairesi", fileNumber: "2024/9876", status: "İcra Takibinde" },
  { id: 3, owner: "GHI Otomotiv", plate: "35 GHI 789", accidentDate: "15.04.2024", debtor: "PQR Sigorta A.Ş.", enforcementOffice: "İzmir 5. İcra Dairesi", fileNumber: "2024/5432", status: "Taksitli Ödeme" },
  { id: 4, owner: "JKL Rent A Car", plate: "07 JKL 101", accidentDate: "03.04.2024", debtor: "STU Sigorta A.Ş.", enforcementOffice: "Bursa 7. İcra Dairesi", fileNumber: "2024/7654", status: "Sonuçlandı" },
  { id: 5, owner: "MNO Rent A Car", plate: "34 MNO 202", accidentDate: "25.03.2024", debtor: "VWX Sigorta A.Ş.", enforcementOffice: "İstanbul 15. İcra Dairesi", fileNumber: "2024/19283", status: "Devam Ediyor" },
  { id: 6, owner: "PQR Turizm", plate: "16 PQR 303", accidentDate: "18.03.2024", debtor: "YZA Sigorta A.Ş.", enforcementOffice: "Ankara 18. İcra Dairesi", fileNumber: "2024/4455", status: "İcra Takibinde" },
  { id: 7, owner: "RST Otomotiv", plate: "41 RST 404", accidentDate: "10.03.2024", debtor: "BCD Sigorta A.Ş.", enforcementOffice: "İzmir 1. İcra Dairesi", fileNumber: "2024/3344", status: "Beklemede" },
  { id: 8, owner: "UVW Rent A Car", plate: "09 UVW 505", accidentDate: "02.03.2024", debtor: "EFG Sigorta A.Ş.", enforcementOffice: "Kocaeli 3. İcra Dairesi", fileNumber: "2024/7788", status: "Taksitli Ödeme" },
  { id: 9, owner: "XYZ Turizm", plate: "34 XYZ 606", accidentDate: "22.02.2024", debtor: "HIJ Sigorta A.Ş.", enforcementOffice: "Antalya 2. İcra Dairesi", fileNumber: "2024/5566", status: "Sonuçlandı" },
  { id: 10, owner: "AAA Rent A Car", plate: "35 AAA 707", accidentDate: "11.02.2024", debtor: "KLM Sigorta A.Ş.", enforcementOffice: "İstanbul 20. İcra Dairesi", fileNumber: "2024/8899", status: "Devam Ediyor" },
  { id: 11, owner: "BRS Filo", plate: "34 BRS 808", accidentDate: "05.02.2024", debtor: "NOP Sigorta A.Ş.", enforcementOffice: "İstanbul 4. İcra Dairesi", fileNumber: "2024/9012", status: "Beklemede" },
  { id: 12, owner: "Kuzey Otomotiv", plate: "61 KZY 909", accidentDate: "30.01.2024", debtor: "RST Sigorta A.Ş.", enforcementOffice: "Trabzon 2. İcra Dairesi", fileNumber: "2024/1122", status: "İcra Takibinde" },
  { id: 13, owner: "Güney Turizm", plate: "01 GNY 010", accidentDate: "22.01.2024", debtor: "UVY Sigorta A.Ş.", enforcementOffice: "Adana 6. İcra Dairesi", fileNumber: "2024/2233", status: "Sonuçlandı" },
];

function Icon({ name }: { name: "download" | "eye" | "more" | "plus" | "search" | "sort" | "x" }) {
  const paths = {
    download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2" /></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    more: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    sort: <path d="m8 9 4-4 4 4M16 15l-4 4-4-4" />,
    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function FilesPage() {
  const searchParams = useSearchParams();
  const createdReference = searchParams.get("created");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [detailRecord, setDetailRecord] = useState<CaseRecord | null>(null);
  const [actionMenu, setActionMenu] = useState<number | null>(null);
  const [notice, setNotice] = useState(createdReference ? `${createdReference} numaralı dosya başarıyla oluşturuldu.` : "");

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    if (!normalizedQuery) return caseRecords;
    return caseRecords.filter((record) => Object.values(record).some((value) => String(value).toLocaleLowerCase("tr-TR").includes(normalizedQuery)));
  }, [query]);

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / rowsPerPage));
  const safePage = Math.min(currentPage, pageCount);
  const visibleRecords = filteredRecords.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);
  const allVisibleSelected = visibleRecords.length > 0 && visibleRecords.every((record) => selectedIds.includes(record.id));

  function toggleRecord(id: number) {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id]);
  }

  function toggleVisibleRecords() {
    setSelectedIds((ids) => allVisibleSelected ? ids.filter((id) => !visibleRecords.some((record) => record.id === id)) : [...new Set([...ids, ...visibleRecords.map((record) => record.id)])]);
  }

  function exportRecords() {
    const exportList = selectedIds.length ? filteredRecords.filter((record) => selectedIds.includes(record.id)) : filteredRecords;
    const rows = [
      ["Ruhsat Sahibi", "Araç Plakası", "Kaza Tarihi", "Borçlu Taraf", "İcra Dairesi", "Dosya No", "Durum"],
      ...exportList.map((record) => [record.owner, record.plate, record.accidentDate, record.debtor, record.enforcementOffice, record.fileNumber, record.status]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "humanum-dosyalari.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`${exportList.length} dosya dışa aktarıldı.`);
  }

  const searchField = (
    <label className={styles.searchField}>
      <span className={styles.srOnly}>Dosyalarda ara</span>
      <input value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} placeholder="Plaka, dosya no, taraf, sigorta..." />
      <Icon name="search" />
    </label>
  );

  return (
    <AppShell headerContent={searchField}>
      <div className={styles.filesPage}>
        <header className={styles.pageHeader}>
          <div><h1>Dosyalarım</h1><p><Link href="/dashboard">Ana Sayfa</Link><span>›</span>Dosyalarım</p></div>
          <div className={styles.mobileSearch}>{searchField}</div>
        </header>

        <section className={styles.tableCard}>
          <header className={styles.tableToolbar}>
            <div><h2>Dosya Listesi</h2>{selectedIds.length > 0 && <span>{selectedIds.length} dosya seçildi</span>}</div>
            <div className={styles.toolbarActions}>
              <button className={styles.exportButton} type="button" onClick={exportRecords}><Icon name="download" />Excel&apos;e Aktar</button>
              <Link className={styles.newFileButton} href="/dosyalarim/yeni"><Icon name="plus" />Yeni Dosya<span>⌄</span></Link>
            </div>
          </header>

          {notice && <p className={styles.notice} role="status">{notice}<button type="button" aria-label="Bildirimi kapat" onClick={() => setNotice("")}><Icon name="x" /></button></p>}

          <div className={styles.tableViewport}>
            <table>
              <thead><tr>
                <th><input type="checkbox" aria-label="Görünen dosyaların tümünü seç" checked={allVisibleSelected} onChange={toggleVisibleRecords} /></th>
                <th>Ruhsat Sahibi <Icon name="sort" /></th><th>Araç Plakası <Icon name="sort" /></th><th>Kaza Tarihi <Icon name="sort" /></th><th>Borçlu Taraf <Icon name="sort" /></th><th>İcra Dairesi / No <Icon name="sort" /></th><th>Dosya Durumu <Icon name="sort" /></th><th>İşlemler</th>
              </tr></thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr key={record.id}>
                    <td><input type="checkbox" aria-label={`${record.plate} dosyasını seç`} checked={selectedIds.includes(record.id)} onChange={() => toggleRecord(record.id)} /></td>
                    <td><strong>{record.owner}</strong></td><td>{record.plate}</td><td>{record.accidentDate}</td><td>{record.debtor}</td>
                    <td><span>{record.enforcementOffice}</span><small>{record.fileNumber}</small></td>
                    <td><span className={`${styles.status} ${styles[`status${record.status.replaceAll(" ", "")}`]}`}>{record.status}</span></td>
                    <td><div className={styles.rowActions}>
                      <button type="button" aria-label={`${record.plate} dosyasını görüntüle`} onClick={() => setDetailRecord(record)}><Icon name="eye" /></button>
                      <div className={styles.actionWrapper}><button type="button" aria-label={`${record.plate} işlem menüsü`} aria-expanded={actionMenu === record.id} onClick={() => setActionMenu((id) => id === record.id ? null : record.id)}><Icon name="more" /></button>
                        {actionMenu === record.id && <div className={styles.actionMenu}><button type="button" onClick={() => { setNotice(`${record.plate} için düzenleme ekranı backend aşamasında bağlanacak.`); setActionMenu(null); }}>Düzenle</button><button type="button" onClick={() => { setNotice(`${record.plate} için hatırlatma ekranı yeni dosya formuyla birlikte bağlanacak.`); setActionMenu(null); }}>Hatırlatma Ekle</button></div>}
                      </div>
                    </div></td>
                  </tr>
                ))}
                {visibleRecords.length === 0 && <tr><td className={styles.emptyState} colSpan={8}>Aramanızla eşleşen dosya bulunamadı.</td></tr>}
              </tbody>
            </table>
          </div>

          <footer className={styles.tableFooter}>
            <p>{filteredRecords.length ? (safePage - 1) * rowsPerPage + 1 : 0} - {Math.min(safePage * rowsPerPage, filteredRecords.length)} / {filteredRecords.length} kayıt gösteriliyor</p>
            <div className={styles.pagination}>
              <button type="button" disabled={safePage === 1} onClick={() => setCurrentPage(1)}>«</button><button type="button" disabled={safePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>‹</button>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button className={safePage === page ? styles.activePage : ""} type="button" key={page} onClick={() => setCurrentPage(page)}>{page}</button>)}
              <button type="button" disabled={safePage === pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}>›</button><button type="button" disabled={safePage === pageCount} onClick={() => setCurrentPage(pageCount)}>»</button>
            </div>
            <label className={styles.rowsPerPage}><select value={rowsPerPage} onChange={(event) => { setRowsPerPage(Number(event.target.value)); setCurrentPage(1); }}><option value="5">5 / sayfa</option><option value="10">10 / sayfa</option><option value="20">20 / sayfa</option></select></label>
          </footer>
        </section>
      </div>

      {detailRecord && <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setDetailRecord(null)}><section className={styles.detailModal} role="dialog" aria-modal="true" aria-labelledby="detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p>Dosya Detayı</p><h2 id="detail-title">{detailRecord.plate}</h2></div><button type="button" aria-label="Detay penceresini kapat" onClick={() => setDetailRecord(null)}><Icon name="x" /></button></header>
        <dl><div><dt>Ruhsat Sahibi</dt><dd>{detailRecord.owner}</dd></div><div><dt>Borçlu Taraf</dt><dd>{detailRecord.debtor}</dd></div><div><dt>Kaza Tarihi</dt><dd>{detailRecord.accidentDate}</dd></div><div><dt>İcra Dairesi</dt><dd>{detailRecord.enforcementOffice}</dd></div><div><dt>Dosya Numarası</dt><dd>{detailRecord.fileNumber}</dd></div><div><dt>Dosya Durumu</dt><dd><span className={`${styles.status} ${styles[`status${detailRecord.status.replaceAll(" ", "")}`]}`}>{detailRecord.status}</span></dd></div></dl>
        <footer><button type="button" onClick={() => setDetailRecord(null)}>Kapat</button></footer>
      </section></div>}
    </AppShell>
  );
}
