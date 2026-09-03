"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AppShell from "@/components/app-shell/AppShell";
import { CASE_STATUS_LABELS as statusLabels, formatCaseDate as formatDate, type CaseStatus } from "@/lib/case-presentation";
import CaseDetailModal from "./CaseDetailModal";
import styles from "./page.module.css";

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
type StatusFilter = "ALL" | CaseStatus;

const sortOptions = {
  newest: { label: "Son eklenenler", field: "createdAt", direction: "desc" },
  oldest: { label: "İlk eklenenler", field: "createdAt", direction: "asc" },
  accidentNewest: { label: "Kaza tarihi: en yeni", field: "accidentDate", direction: "desc" },
  accidentOldest: { label: "Kaza tarihi: en eski", field: "accidentDate", direction: "asc" },
  status: { label: "Dosya durumuna göre", field: "status", direction: "asc" },
  holder: { label: "Ruhsat sahibi: A-Z", field: "licenseHolder", direction: "asc" },
  plate: { label: "Plaka: A-Z", field: "vehiclePlate", direction: "asc" },
} as const satisfies Record<string, { label: string; field: SortField; direction: "asc" | "desc" }>;

type SortOption = keyof typeof sortOptions;

function Icon({ name }: { name: "eye" | "more" | "plus" | "search" | "x" }) {
  const paths = {
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    more: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function FilesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createdReference = searchParams.get("created");
  const documentFailed = searchParams.get("document") === "failed";
  const linkedCaseId = searchParams.get("case")?.slice(0, 200) ?? "";
  const initialQuery = searchParams.get("query")?.slice(0, 200) ?? "";
  const initialStatus = parseStatusFilter(searchParams.get("status"));
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  const [records, setRecords] = useState<CaseRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 10, pageCount: 1, totalCount: 0 });
  const [detailRequest, setDetailRequest] = useState<{ id: string; mode: "view" | "edit" | "reminder" } | null>(linkedCaseId ? { id: linkedCaseId, mode: "view" } : null);
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
        const selectedSort = sortOptions[sortOption];
        const parameters = new URLSearchParams({
          query: debouncedQuery,
          status: statusFilter,
          page: String(currentPage),
          pageSize: String(rowsPerPage),
          sortBy: selectedSort.field,
          sortDirection: selectedSort.direction,
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
  }, [debouncedQuery, currentPage, rowsPerPage, refreshKey, router, sortOption, statusFilter]);

  const visiblePages = useMemo(() => getVisiblePages(pagination.page, pagination.pageCount), [pagination]);

  function clearListControls() {
    setQuery("");
    setStatusFilter("ALL");
    setSortOption("newest");
    setCurrentPage(1);
  }

  const controlsActive = query.trim() !== "" || statusFilter !== "ALL" || sortOption !== "newest";

  const searchField = <div className={styles.searchField}>
    <label className={styles.srOnly} htmlFor="case-search">Dosyalarda ara</label>
    <input id="case-search" value={query} onChange={(event) => { setQuery(event.target.value.toLocaleUpperCase("tr-TR")); setCurrentPage(1); }} maxLength={20} placeholder="Araç plakası ara..." />
    {query && <button className={styles.clearSearch} type="button" aria-label="Aramayı temizle" onClick={() => { setQuery(""); setCurrentPage(1); }}><Icon name="x" /></button>}
    <span className={styles.searchIcon}><Icon name="search" /></span>
  </div>;

  return <AppShell headerContent={searchField}>
    <div className={styles.filesPage}>
      <header className={styles.pageHeader}>
        <div className={styles.pageIntro}>
          <span className={styles.eyebrow}>DOSYA YÖNETİMİ</span>
          <h1>Dosyalarım</h1>
          <p className={styles.pageDescription}>Tüm dosyaları görüntüleyin, arayın ve işlemleri tek ekrandan yönetin.</p>
          <p className={styles.breadcrumb}><Link href="/dashboard">Ana Sayfa</Link><span>›</span>Dosyalarım</p>
        </div>
        <div className={styles.recordSummary}><strong>{pagination.totalCount}</strong><span>{query.trim() || statusFilter !== "ALL" ? "Eşleşen dosya" : "Toplam dosya"}</span></div>
        <div className={styles.mobileSearch}>{searchField}</div>
      </header>

      <section className={styles.tableCard}>
        <header className={styles.tableToolbar}>
          <div><h2>Dosya Listesi</h2><span>{pagination.totalCount} kayıt</span></div>
          <div className={styles.toolbarActions}>
            <div className={styles.listControls}>
              <label><span>Durum</span><select value={statusFilter} disabled={isLoading} onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); setCurrentPage(1); }}><option value="ALL">Tüm durumlar</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label><span>Sırala</span><select value={sortOption} disabled={isLoading} onChange={(event) => { setSortOption(event.target.value as SortOption); setCurrentPage(1); }}>{Object.entries(sortOptions).map(([value, option]) => <option value={value} key={value}>{option.label}</option>)}</select></label>
              {controlsActive && <button className={styles.clearControls} type="button" onClick={clearListControls}>Temizle</button>}
            </div>
            <Link className={styles.newFileButton} href="/dosyalarim/yeni"><Icon name="plus" />Yeni Dosya<span>⌄</span></Link>
          </div>
        </header>

        {notice && <p className={styles.notice} role="status">{notice}<button type="button" aria-label="Bildirimi kapat" onClick={() => setNotice("")}><Icon name="x" /></button></p>}
        {error && <p className={`${styles.notice} ${styles.errorNotice}`} role="alert">{error}<button type="button" aria-label="Hatayı kapat" onClick={() => setError("")}><Icon name="x" /></button></p>}

        <div className={styles.tableViewport}>
          <table>
            <thead><tr>
              <th>Ruhsat Sahibi</th>
              <th>Araç Plakası</th>
              <th>Kaza Tarihi</th>
              <th>Borçlu Taraf</th>
              <th>İcra Dairesi / No</th>
              <th>Dosya Durumu</th>
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
              {!isLoading && !error && records.length === 0 && <tr><td className={styles.emptyState} colSpan={7}>{debouncedQuery || statusFilter !== "ALL" ? "Seçilen arama ve filtrelerle eşleşen dosya bulunamadı." : "Henüz kayıtlı dosya bulunmuyor."}</td></tr>}
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

function getVisiblePages(currentPage: number, pageCount: number): number[] {
  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages].filter((page) => page >= 1 && page <= pageCount).sort((left, right) => left - right);
}

function parseStatusFilter(value: string | null): StatusFilter {
  return value && Object.hasOwn(statusLabels, value) ? value as CaseStatus : "ALL";
}
