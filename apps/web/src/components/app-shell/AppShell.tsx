"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import styles from "./AppShell.module.css";

type IconName =
  | "bell"
  | "briefcase"
  | "chevron"
  | "close"
  | "folder"
  | "home"
  | "logout"
  | "menu"
  | "plus"
  | "eye"
  | "users";

type AppShellProps = {
  children: ReactNode;
  headerContent?: ReactNode;
  hideTopbar?: boolean;
};

type TeamMember = {
  id: string;
  email: string;
  name: string;
  role?: string | null;
  banned?: boolean | null;
};

type AdminNotification = {
  id: string;
  caseFileId: string;
  title: string;
  dueAt: string;
  status: "PENDING" | "PARTIALLY_SENT" | "FAILED";
  referenceNumber: string;
  vehiclePlate: string;
};

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  };

  return <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase("tr-TR") || "HU";
}

export default function AppShell({ children, headerContent, hideTopbar = false }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const displayName = session?.user.name || "Kullanıcı";
  const isManager = session?.user.role === "admin";
  const currentUser = {
    initials: getInitials(displayName),
    name: displayName,
    fullName: displayName,
    email: session?.user.email ?? "",
    role: isManager ? "Yönetici" : "Kullanıcı",
    isManager,
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamState, setTeamState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [managementNotice, setManagementNotice] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [changingUserId, setChangingUserId] = useState<string | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<TeamMember | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [openMenu, setOpenMenu] = useState<"notifications" | "profile" | null>(null);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationState, setNotificationState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const menuAreaRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    setNotificationState("loading");

    try {
      const response = await fetch("/api/notifications", {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      const result = await response.json() as {
        data?: { items: AdminNotification[]; totalCount: number };
      };

      if (!response.ok || !result.data) {
        throw new Error("Notifications unavailable");
      }

      setNotifications(result.data.items);
      setNotificationCount(result.data.totalCount);
      setNotificationState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setNotifications([]);
      setNotificationCount(0);
      setNotificationState("error");
    }
  }, []);

  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      if (!menuAreaRef.current?.contains(event.target as Node)) setOpenMenu(null);
    }

    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  useEffect(() => {
    if (!isManager) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => void loadNotifications(controller.signal), 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [isManager, loadNotifications]);

  async function loadTeamMembers() {
    setTeamState("loading");
    const { data, error } = await authClient.admin.listUsers({
      query: { limit: 50, sortBy: "name", sortDirection: "asc" },
    });

    if (error || !data) {
      setTeamState("error");
      setManagementNotice("Kullanıcı listesi yüklenemedi. Lütfen tekrar deneyin.");
      return;
    }

    setTeamMembers(data.users);
    setTeamState("ready");
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    setIsCreatingUser(true);
    setManagementNotice("");

    const { error } = await authClient.admin.createUser({
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      password: String(formData.get("password") ?? ""),
      role: "user",
    });

    if (error) {
      setManagementNotice(error.status === 422 || error.status === 400
        ? "Bilgiler geçersiz veya bu e-posta adresi zaten kullanılıyor."
        : "Kullanıcı oluşturulamadı. Lütfen tekrar deneyin.");
      setIsCreatingUser(false);
      return;
    }

    form.reset();
    setCreateUserOpen(false);
    setManagementNotice("Kullanıcı güvenli şekilde oluşturuldu.");
    setIsCreatingUser(false);
    await loadTeamMembers();
  }

  async function handleUserStatusChange(member: TeamMember) {
    const isBanned = member.banned === true;
    if (!isBanned) {
      setPendingStatusChange(member);
      return;
    }

    await applyUserStatusChange(member, "unban");
  }

  async function applyUserStatusChange(member: TeamMember, action: "ban" | "unban") {
    setChangingUserId(member.id);
    setManagementNotice("");
    try {
      const response = await fetch("/api/admin/users/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId: member.id, action }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) {
        setManagementNotice(result.error?.message ?? "Kullanıcı durumu değiştirilemedi.");
        return;
      }

      setManagementNotice(action === "unban" ? `${member.name} tekrar aktifleştirildi.` : `${member.name} pasifleştirildi.`);
      await loadTeamMembers();
    } catch {
      setManagementNotice("Kullanıcı durumu değiştirilemedi. Lütfen tekrar deneyin.");
    } finally {
      setChangingUserId(null);
    }
  }

  async function confirmUserDeactivation() {
    if (!pendingStatusChange) return;

    const member = pendingStatusChange;
    setPendingStatusChange(null);
    await applyUserStatusChange(member, "ban");
  }

  async function handleSignOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className={`${styles.shell} ${sidebarCollapsed ? styles.shellCollapsed : ""}`}>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarBrand}>
          <Image src="/images/humanum-mark.png" alt="" width={48} height={45} priority />
          <div className={styles.brandText}><span>HUMANUM</span><small>HUKUK</small></div>
          <button className={styles.mobileClose} type="button" aria-label="Menüyü kapat" onClick={() => setSidebarOpen(false)}><Icon name="close" /></button>
        </div>

        <nav className={styles.navigation} aria-label="Ana menü">
          <Link className={`${styles.navItem} ${pathname === "/dashboard" ? styles.navItemActive : ""}`} href="/dashboard" onClick={() => setSidebarOpen(false)}>
            <Icon name="home" /><span>Dashboard</span>
          </Link>
          <Link className={`${styles.navItem} ${pathname.startsWith("/dosyalarim") ? styles.navItemActive : ""}`} href="/dosyalarim" onClick={() => setSidebarOpen(false)}>
            <Icon name="folder" /><span>Dosyalarım</span>
          </Link>
        </nav>

        <div className={styles.sidebarFooter}>
          {currentUser.isManager && teamOpen && (
            <div className={styles.teamPanel}>
              <div className={styles.teamPanelHeader}><strong>Ekip</strong><span>{teamState === "ready" ? `${teamMembers.length} kişi` : "Yönetim"}</span></div>
              <div className={styles.teamList}>
                {teamState === "loading" && <p className={styles.managementNotice}>Kullanıcılar yükleniyor...</p>}
                {teamState === "error" && <button className={styles.retryButton} type="button" onClick={loadTeamMembers}>Tekrar dene</button>}
                {teamMembers.map((member) => (
                  <div className={styles.teamMember} key={member.id}>
                    <span className={styles.memberAvatar}>{getInitials(member.name)}</span>
                    <span className={styles.memberInfo}><strong>{member.name}</strong><small>{member.role === "admin" ? "Yönetici" : "Kullanıcı"} · {member.banned ? "Pasif" : "Aktif"}</small></span>
                    {member.id !== session?.user.id && <button className={styles.statusButton} type="button" onClick={() => void handleUserStatusChange(member)} disabled={changingUserId !== null}>
                      {changingUserId === member.id ? "..." : member.banned ? "Tekrar Aktifleştir" : "Pasifleştir"}
                    </button>}
                  </div>
                ))}
              </div>
              {createUserOpen && <form className={styles.createUserForm} onSubmit={handleCreateUser}>
                <label><span>Ad Soyad</span><input name="name" required minLength={2} maxLength={80} autoComplete="off" disabled={isCreatingUser} /></label>
                <label><span>E-posta</span><input name="email" type="email" required autoComplete="off" disabled={isCreatingUser} /></label>
                <label><span>Geçici Şifre</span><span className={styles.passwordField}><input name="password" type={showTemporaryPassword ? "text" : "password"} required minLength={10} maxLength={128} autoComplete="new-password" disabled={isCreatingUser} /><button type="button" className={styles.passwordToggle} aria-label={showTemporaryPassword ? "Geçici şifreyi gizle" : "Geçici şifreyi göster"} aria-pressed={showTemporaryPassword} onClick={() => setShowTemporaryPassword((visible) => !visible)} disabled={isCreatingUser}><Icon name="eye" /></button></span></label>
                <div><button type="button" onClick={() => setCreateUserOpen(false)} disabled={isCreatingUser}>Vazgeç</button><button type="submit" disabled={isCreatingUser}>{isCreatingUser ? "Ekleniyor..." : "Kullanıcıyı Ekle"}</button></div>
              </form>}
              {!createUserOpen && <button className={styles.addMemberButton} type="button" onClick={() => { setCreateUserOpen(true); setManagementNotice(""); }}><Icon name="plus" />Yeni kullanıcı ekle</button>}
              {managementNotice && <p className={styles.managementNotice} role="status">{managementNotice}</p>}
            </div>
          )}
          <button className={styles.sidebarUser} type="button" aria-expanded={teamOpen} onClick={() => {
            if (sidebarCollapsed) setSidebarCollapsed(false);
            if (currentUser.isManager) {
              setTeamOpen((value) => !value);
              if (!teamOpen && teamState === "idle") void loadTeamMembers();
            }
          }}>
            <span className={styles.avatar}>{currentUser.initials}</span>
            <span className={styles.sidebarUserText}><strong>{currentUser.name}</strong><small>{currentUser.role}</small></span>
            {currentUser.isManager && <span className={`${styles.teamChevron} ${teamOpen ? styles.teamChevronOpen : ""}`}><Icon name="chevron" /></span>}
          </button>
          <button className={styles.logoutLink} type="button" onClick={handleSignOut} disabled={isSigningOut}><Icon name="logout" /><span>{isSigningOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}</span></button>
        </div>
      </aside>

      {sidebarOpen && <button className={styles.backdrop} type="button" aria-label="Menüyü kapat" onClick={() => setSidebarOpen(false)} />}

      {pendingStatusChange && <div className={styles.confirmationBackdrop} role="presentation" onMouseDown={() => setPendingStatusChange(null)}>
        <section className={styles.confirmationDialog} role="dialog" aria-modal="true" aria-labelledby="deactivation-title" aria-describedby="deactivation-description" onMouseDown={(event) => event.stopPropagation()}>
          <p className={styles.confirmationEyebrow}>Kullanıcı erişimi</p>
          <h2 id="deactivation-title">Kullanıcıyı pasifleştir?</h2>
          <p id="deactivation-description"><strong>{pendingStatusChange.name}</strong> adlı kullanıcının hesabı pasifleştirilecek. Açık oturumları sonlandırılacak ve yeniden aktifleştirilene kadar giriş yapamayacak.</p>
          <div className={styles.confirmationActions}>
            <button type="button" onClick={() => setPendingStatusChange(null)}>Vazgeç</button>
            <button type="button" className={styles.dangerButton} onClick={() => void confirmUserDeactivation()}>Pasifleştir</button>
          </div>
        </section>
      </div>}

      <div className={`${styles.workspace} ${hideTopbar ? styles.workspaceWithoutTopbar : ""}`}>
        {!hideTopbar && <header className={styles.topbar}>
          <button className={styles.menuButton} type="button" aria-label="Menüyü aç veya daralt" onClick={() => window.innerWidth < 900 ? setSidebarOpen(true) : setSidebarCollapsed((value) => !value)}>
            <Icon name="menu" />
          </button>

          {headerContent && <div className={styles.headerContent}>{headerContent}</div>}

          <div className={styles.topbarMenus} ref={menuAreaRef}>
            {currentUser.isManager && <div className={styles.menuWrapper}>
              <button className={styles.notificationButton} type="button" aria-label="Bildirimler" aria-expanded={openMenu === "notifications"} onClick={() => {
                setOpenMenu((value) => value === "notifications" ? null : "notifications");
                if (notificationState === "error") void loadNotifications();
              }}>
                <Icon name="bell" />{notificationCount > 0 && <span className={styles.notificationCount}>{Math.min(notificationCount, 99)}</span>}
              </button>
              {openMenu === "notifications" && (
                <div className={styles.popover}>
                  <div className={styles.popoverHeader}><strong>Bildirimler</strong><span>{notificationCount} yaklaşan</span></div>
                  {notificationState === "loading" && <p><small>Bildirimler yükleniyor...</small></p>}
                  {notificationState === "error" && <p><b>Bildirimler yüklenemedi</b><small>Tekrar denemek için zil simgesine basın.</small></p>}
                  {notificationState === "ready" && notifications.length === 0 && <p><small>Yaklaşan veya gecikmiş hatırlatma bulunmuyor.</small></p>}
                  {notifications.map((notification) => <Link className={styles.notificationLink} href={`/dosyalarim?query=${encodeURIComponent(notification.referenceNumber)}`} onClick={() => setOpenMenu(null)} key={notification.id}>
                    <b>{notification.title}{notification.status === "FAILED" ? " · Gönderim başarısız" : ""}</b>
                    <small>{notification.referenceNumber} · {formatNotificationDate(notification.dueAt)}</small>
                  </Link>)}
                </div>
              )}
            </div>}

            <div className={styles.menuWrapper}>
              <button className={styles.profileButton} type="button" aria-expanded={openMenu === "profile"} onClick={() => setOpenMenu((value) => value === "profile" ? null : "profile")}>
                <span className={styles.avatar}>{currentUser.initials}</span>
                <span className={styles.profileText}><strong>{currentUser.name}</strong><small>{currentUser.role}</small></span>
                <Icon name="chevron" />
              </button>
              {openMenu === "profile" && (
                <div className={`${styles.popover} ${styles.profilePopover}`}>
                  <p><b>{currentUser.fullName}</b><small>{currentUser.email}</small></p>
                  {currentUser.isManager && <button className={styles.profileAction} type="button" onClick={() => {
                    setOpenMenu(null);
                    setSidebarCollapsed(false);
                    setSidebarOpen(true);
                    setTeamOpen(true);
                    if (teamState === "idle") void loadTeamMembers();
                  }}><Icon name="users" /> Kullanıcı Yönetimi</button>}
                  <button type="button" onClick={handleSignOut} disabled={isSigningOut}><Icon name="logout" /> {isSigningOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}</button>
                </div>
              )}
            </div>
          </div>
        </header>}

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

function formatNotificationDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}
