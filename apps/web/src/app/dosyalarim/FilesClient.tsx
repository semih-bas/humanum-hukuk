"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AppShell from "@/components/app-shell/AppShell";
import CaseDetailModal from "./CaseDetailModal";
import styles from "./page.module.css";

type CaseStatus = "OPEN" | "ENFORCEMENT" | "INSTALLMENT" | "PENDING" | "CLOSED";

type CaseRecord = {
  id: string;
  referenceNumber: string;
  licenseHolder: string;
  vehiclePlate: string;
  accidentDate: string;
  debtorName: string | null;
  enforcementOffice: string | null;
  enforcementFileNumber: string | null;
  status: CaseStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount: number;
};

type SortField = "createdAt" | "licenseHolder" | "vehiclePlate" | "accidentDate" | "debtorName" | "enforcementOffice" | "status";

const statusLabels: Record<CaseStatus, string> = {
  OPEN: "Devam Ediyor",
  ENFORCEMENT: "İcra Takibinde",
  INSTALLMENT: "Taksitli Ödeme",
  PENDING: "Beklemede",
  CLOSED: "Sonuçlandı",
};

function Icon({ name }: { name: "eye" | "more" | "plus" | "search" | "sort" | "x" }) {
  const paths = {
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    more: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    sort: <path d="m8 9 4-4 4 4M16 15l-4 4-4-4" />,
    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function FilesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createdReference = searchParams.get("created");
  const documentFailed = searchParams.get("document") === "failed";
  const initialQuery = searchParams.get("query")?.slice(0, 200) ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  const [records, setRecords] = useState<CaseRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 10, pageCount: 1, totalCount: 0 });
  const [detailRequest, setDetailRequest] = useState<{ id: string; mode: "view" | "edit" | "reminder" } | null>(null);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState(createdReference
    ? `${createdReference} numaralı dosya başarıyla oluşturuldu.${documentFailed ? " Seçilen evrak yüklenemedi; dosya ayrıntısından tekrar ekleyebilirsiniz." : ""}`
    : "");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCases() {
      setIsLoading(true);
      setError("");

      try {
        const parameters = new URLSearchParams({
          query: debouncedQuery,
          page: String(currentPage),
          pageSize: String(rowsPerPage),
          sortBy,
          sortDirection,
        });
        const response = await fetch(`/api/cases?${parameters}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json() as {
          data?: { items: CaseRecord[]; pagination: Pagination };
          error?: { message?: string };
        };

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok || !result.data) {
          throw new Error(result.error?.message ?? "Dosyalar yüklenemedi.");
        }

        setRecords(result.data.items);
        setPagination(result.data.pagination);
        setActionMenu(null);

        if (result.data.pagination.page !== currentPage) {
          setCurrentPage(result.data.pagination.page);
        }
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setRecords([]);
        setError(loadError instanceof Error ? loadError.message : "Dosyalar yüklenemedi.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadCases();
    return () => controller.abort();
  }, [debouncedQuery, currentPage, rowsPerPage, refreshKey, router, sortBy, sortDirection]);

  const visiblePages = useMemo(() => getVisiblePages(pagination.page, pagination.pageCount), [pagination]);

  function changeSort(field: SortField) {
    if (sortBy === field) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDirection("asc"); }
    setCurrentPage(1);
  }

  const searchField = <label className={styles.searchField}>
    <span className={styles.srOnly}>Dosyalarda ara</span>
    <input value={query} onChange={(event) => { setQuery(event.target.value.toLocaleUpperCase("tr-TR")); setCurrentPage(1); }} maxLength={20} placeholder="Araç plakası ara..." />
    <Icon name="search" />
  </label>;

  return <AppShell headerContent={searchField}>
    <div className={styles.filesPage}>
      <header className={styles.pageHeader}>
        <div className={styles.pageIntro}>
          <span className={styles.eyebrow}>DOSYA YÖNETİMİ</span>
          <h1>Dosyalarım</h1>
          <p className={styles.pageDescription}>Tüm dosyaları görüntüleyin, arayın ve işlemleri tek ekrandan yönetin.</p>
          <p className={styles.breadcrumb}><Link href="/dashboard">Ana Sayfa</Link><span>›</span>Dosyalarım</p>
        </div>
        <div className={styles.recordSummary}><strong>{pagination.totalCount}</strong><span>Toplam dosya</span></div>
        <div className={styles.mobileSearch}>{searchField}</div>
      </header>

      <section className={styles.tableCard}>
        <header className={styles.tableToolbar}>
          <div><h2>Dosya Listesi</h2><span>{pagination.totalCount} kayıt</span></div>
          <div className={styles.toolbarActions}>
            <Link className={styles.newFileButton} href="/dosyalarim/yeni"><Icon name="plus" />Yeni Dosya<span>⌄</span></Link>
          </div>
        </header>

        {notice && <p className={styles.notice} role="status">{notice}<button type="button" aria-label="Bildirimi kapat" onClick={() => setNotice("")}><Icon name="x" /></button></p>}
        {error && <p className={`${styles.notice} ${styles.errorNotice}`} role="alert">{error}<button type="button" aria-label="Hatayı kapat" onClick={() => setError("")}><Icon name="x" /></button></p>}

        <div className={styles.tableViewport}>
          <table>
            <thead><tr>
              <SortableHeader label="Ruhsat Sahibi" field="licenseHolder" activeField={sortBy} direction={sortDirection} onSort={changeSort} />
              <SortableHeader label="Araç Plakası" field="vehiclePlate" activeField={sortBy} direction={sortDirection} onSort={changeSort} />
              <SortableHeader label="Kaza Tarihi" field="accidentDate" activeField={sortBy} direction={sortDirection} onSort={changeSort} />
              <SortableHeader label="Borçlu Taraf" field="debtorName" activeField={sortBy} direction={sortDirection} onSort={changeSort} />
              <SortableHeader label="İcra Dairesi / No" field="enforcementOffice" activeField={sortBy} direction={sortDirection} onSort={changeSort} />
              <SortableHeader label="Dosya Durumu" field="status" activeField={sortBy} direction={sortDirection} onSort={changeSort} />
              <th>İşlemler</th>
            </tr></thead>
            <tbody>
              {!isLoading && records.map((record) => {
                const statusLabel = statusLabels[record.status];
                return <tr key={record.id}>
                  <td><strong>{record.licenseHolder}</strong><small>{record.referenceNumber}{record.version > 1 ? " · Düzenlendi" : ""}</small></td>
                  <td>{record.vehiclePlate}</td>
                  <td>{formatDate(record.accidentDate)}</td>
                  <td>{record.debtorName ?? "—"}</td>
                  <td><span>{record.enforcementOffice ?? "—"}</span><small>{record.enforcementFileNumber ?? "Dosya numarası yok"}</small></td>
                  <td><span className={`${styles.status} ${styles[`status${statusLabel.replaceAll(" ", "")}`]}`}>{statusLabel}</span></td>
                  <td><div className={styles.rowActions}>
                    <button type="button" aria-label={`${record.vehiclePlate} dosyasını görüntüle`} onClick={() => setDetailRequest({ id: record.id, mode: "view" })}><Icon name="eye" /></button>
                    <div className={styles.actionWrapper}>
                      <button type="button" aria-label={`${record.vehiclePlate} işlem menüsü`} aria-expanded={actionMenu === record.id} onClick={() => setActionMenu((id) => id === record.id ? null : record.id)}><Icon name="more" /></button>
                      {actionMenu === record.id && <div className={styles.actionMenu}><button type="button" onClick={() => { setDetailRequest({ id: record.id, mode: "edit" }); setActionMenu(null); }}>Düzenle</button><button type="button" onClick={() => { setDetailRequest({ id: record.id, mode: "reminder" }); setActionMenu(null); }}>Hatırlatma Ekle</button></div>}
                    </div>
                  </div></td>
                </tr>;
              })}
              {isLoading && <tr><td className={styles.emptyState} colSpan={7}>Dosyalar yükleniyor…</td></tr>}
              {!isLoading && !error && records.length === 0 && <tr><td className={styles.emptyState} colSpan={7}>{debouncedQuery ? "Aramanızla eşleşen dosya bulunamadı." : "Henüz kayıtlı dosya bulunmuyor."}</td></tr>}
            </tbody>
          </table>
        </div>

        <footer className={styles.tableFooter}>
          <p>{pagination.totalCount ? (pagination.page - 1) * pagination.pageSize + 1 : 0} - {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)} / {pagination.totalCount} kayıt gösteriliyor</p>
          <div className={styles.pagination}>
            <button type="button" disabled={isLoading || pagination.page === 1} onClick={() => setCurrentPage(1)}>«</button>
            <button type="button" disabled={isLoading || pagination.page === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>‹</button>
            {visiblePages.map((page) => <button className={pagination.page === page ? styles.activePage : ""} type="button" key={page} disabled={isLoading} onClick={() => setCurrentPage(page)}>{page}</button>)}
            <button type="button" disabled={isLoading || pagination.page === pagination.pageCount} onClick={() => setCurrentPage((page) => Math.min(pagination.pageCount, page + 1))}>›</button>
            <button type="button" disabled={isLoading || pagination.page === pagination.pageCount} onClick={() => setCurrentPage(pagination.pageCount)}>»</button>
          </div>
          <label className={styles.rowsPerPage}><select value={rowsPerPage} disabled={isLoading} onChange={(event) => { setRowsPerPage(Number(event.target.value)); setCurrentPage(1); }}><option value="5">5 / sayfa</option><option value="10">10 / sayfa</option><option value="20">20 / sayfa</option></select></label>
        </footer>
      </section>
    </div>

    {detailRequest && <CaseDetailModal
      caseId={detailRequest.id}
      initialMode={detailRequest.mode}
      onClose={() => setDetailRequest(null)}
      onSaved={() => { setRefreshKey((value) => value + 1); setNotice("Dosya başarıyla güncellendi ve değişiklik geçmişine kaydedildi."); }}
    />}
  </AppShell>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function getVisiblePages(currentPage: number, pageCount: number): number[] {
  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages].filter((page) => page >= 1 && page <= pageCount).sort((left, right) => left - right);
}

function SortableHeader({ label, field, activeField, direction, onSort }: { label: string; field: SortField; activeField: SortField; direction: "asc" | "desc"; onSort: (field: SortField) => void }) {
  const active = field === activeField;
  return <th aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}><button className={`${styles.sortButton} ${active ? styles.sortActive : ""}`} type="button" onClick={() => onSort(field)} aria-label={`${label} sütununu sırala`}>{label}<Icon name="sort" /></button></th>;
}
