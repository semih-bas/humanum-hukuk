"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import styles from "./AppShell.module.css";

type IconName =
  | "bell"
  | "briefcase"
  | "chevron"
  | "close"
  | "folder"
  | "home"
  | "key"
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
  emailVerified: boolean;
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
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M15 8l3 3M13 10l3 3" /></>,
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
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamQuery, setTeamQuery] = useState("");
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
  const teamAreaRef = useRef<HTMLDivElement>(null);

  const visibleTeamMembers = useMemo(() => {
    const query = teamQuery.trim().toLocaleLowerCase("tr-TR");
    const statusRank = (member: TeamMember) => member.banned ? 2 : member.emailVerified ? 0 : 1;
    return teamMembers
      .filter((member) => !query || member.name.toLocaleLowerCase("tr-TR").includes(query))
      .sort((left, right) => statusRank(left) - statusRank(right) || left.name.localeCompare(right.name, "tr-TR"));
  }, [teamMembers, teamQuery]);

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
    if (!teamOpen) return;

    function closeTeamPanel(event: MouseEvent) {
      if (!teamAreaRef.current?.contains(event.target as Node)) setTeamOpen(false);
    }

    document.addEventListener("mousedown", closeTeamPanel);
    return () => document.removeEventListener("mousedown", closeTeamPanel);
  }, [teamOpen]);

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

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const { error } = await authClient.admin.createUser({
      name: String(formData.get("name") ?? "").trim(),
      email,
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

    const verification = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/login",
    });

    form.reset();
    setCreateUserOpen(false);
    setShowTemporaryPassword(false);
    setTeamOpen(true);
    setManagementNotice(verification.error
      ? "Kullanıcı oluşturuldu ancak doğrulama e-postası gönderilemedi. Kullanıcı giriş ekranından yeniden isteyebilir."
      : "Kullanıcı oluşturuldu ve e-posta doğrulama bağlantısı gönderildi.");
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
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarBrand}>
          <Image src="/images/humanum-mark.png" alt="" width={48} height={45} priority />
          <div className={styles.brandText}><span>HUMANUM</span><small>HUKUK</small></div>
          <button className={styles.mobileClose} type="button" aria-label="Menüyü kapat" onClick={() => setSidebarOpen(false)}><Icon name="close" /></button>
        </div>

        <nav className={styles.navigation} aria-label="Ana menü">
          <Link className={`${styles.navItem} ${pathname === "/dashboard" ? styles.navItemActive : ""}`} href="/dashboard" onClick={() => { setSidebarOpen(false); setTeamOpen(false); }}>
            <Icon name="home" /><span>Dashboard</span>
          </Link>
          <div className={`${styles.navGroup} ${pathname.startsWith("/dosyalarim") ? styles.navGroupActive : ""}`}>
            <Link className={`${styles.navItem} ${pathname === "/dosyalarim" ? styles.navItemActive : ""}`} href="/dosyalarim" onClick={() => { setSidebarOpen(false); setTeamOpen(false); }}>
              <Icon name="folder" /><span>Dosyalarım</span>
            </Link>
            <Link className={`${styles.subNavItem} ${pathname === "/dosyalarim/yeni" ? styles.subNavItemActive : ""}`} href="/dosyalarim/yeni" onClick={() => { setSidebarOpen(false); setTeamOpen(false); }}>
              <span className={styles.subNavMarker}><Icon name="plus" /></span><span>Yeni Dosya Ekle</span>
            </Link>
          </div>
        </nav>

        <div className={styles.sidebarFooter} ref={teamAreaRef}>
          {currentUser.isManager && teamOpen && (
            <div className={styles.teamPanel}>
              <div className={styles.teamPanelHeader}><strong>Ekip</strong><span>{teamState === "ready" ? `${teamQuery.trim() ? `${visibleTeamMembers.length}/` : ""}${teamMembers.length} kişi` : "Yönetim"}</span></div>
              <div className={styles.teamSearch}><label className={styles.srOnly} htmlFor="team-search">Ekipte isim ara</label><input id="team-search" value={teamQuery} onChange={(event) => setTeamQuery(event.target.value)} placeholder="İsim ara…" />{teamQuery && <button type="button" aria-label="İsim aramasını temizle" onClick={() => setTeamQuery("")}>×</button>}</div>
              <div className={styles.teamList}>
                {teamState === "loading" && <p className={styles.managementNotice}>Kullanıcılar yükleniyor...</p>}
                {teamState === "error" && <button className={styles.retryButton} type="button" onClick={loadTeamMembers}>Tekrar dene</button>}
                {visibleTeamMembers.map((member) => (
                  <div className={`${styles.teamMember} ${member.banned ? styles.teamMemberBanned : !member.emailVerified ? styles.teamMemberUnverified : styles.teamMemberActive}`} key={member.id}>
                    <span className={styles.memberAvatar}>{getInitials(member.name)}</span>
                    <span className={styles.memberInfo}><strong>{member.name}</strong><small>{member.role === "admin" ? "Yönetici" : "Kullanıcı"}</small></span>
                    <span className={`${styles.memberStatus} ${member.banned ? styles.memberStatusBanned : !member.emailVerified ? styles.memberStatusUnverified : ""}`}><i />{member.banned ? "Pasif" : member.emailVerified ? "Aktif" : "Doğrulama Bekliyor"}</span>
                    {member.id !== session?.user.id && <button className={styles.statusButton} type="button" onClick={() => void handleUserStatusChange(member)} disabled={changingUserId !== null}>
                      {changingUserId === member.id ? "..." : member.banned ? "Tekrar Aktifleştir" : "Pasifleştir"}
                    </button>}
                  </div>
                ))}
                {teamState === "ready" && visibleTeamMembers.length === 0 && <p className={styles.teamEmpty}>Bu isimle eşleşen kullanıcı bulunamadı.</p>}
              </div>
              <button className={styles.addMemberButton} type="button" onClick={() => { setCreateUserOpen(true); setTeamOpen(false); setManagementNotice(""); }}><Icon name="plus" />Yeni kullanıcı ekle</button>
              {managementNotice && <p className={styles.managementNotice} role="status">{managementNotice}</p>}
            </div>
          )}
          <button className={`${styles.sidebarUser} ${teamOpen ? styles.sidebarUserActive : ""}`} type="button" aria-label={teamOpen ? "Ekip yönetimini kapat" : "Ekip yönetimini aç"} aria-expanded={teamOpen} onClick={() => {
            if (currentUser.isManager) {
              setTeamOpen((value) => !value);
              if (!teamOpen && teamState === "idle") void loadTeamMembers();
            }
          }}>
            <span className={styles.avatar}>{currentUser.initials}</span>
            <span className={styles.sidebarUserText}><strong title={currentUser.name}>{currentUser.name}</strong><small>{currentUser.role}</small></span>
            {currentUser.isManager && <span className={`${styles.teamChevron} ${teamOpen ? styles.teamChevronOpen : ""}`}><Icon name="chevron" /></span>}
          </button>
          <button className={styles.logoutLink} type="button" onClick={handleSignOut} disabled={isSigningOut}><Icon name="logout" /><span>{isSigningOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}</span></button>
        </div>
      </aside>

      {currentUser.isManager && teamOpen && <button className={styles.teamBackdrop} type="button" aria-label="Ekip panelini kapat" onClick={() => setTeamOpen(false)} />}
      {sidebarOpen && <button className={styles.backdrop} type="button" aria-label="Menüyü kapat" onClick={() => { setSidebarOpen(false); setTeamOpen(false); }} />}

      {createUserOpen && <div className={styles.userModalBackdrop} role="presentation" onMouseDown={() => { if (!isCreatingUser) { setCreateUserOpen(false); setShowTemporaryPassword(false); } }}>
        <section className={styles.userModal} role="dialog" aria-modal="true" aria-labelledby="create-user-title" aria-describedby="create-user-description" onMouseDown={(event) => event.stopPropagation()}>
          <header className={styles.userModalHeader}>
            <span className={styles.userModalIcon}><Icon name="users" /></span>
            <span><small>Ekip yönetimi</small><h2 id="create-user-title">Yeni kullanıcı ekle</h2></span>
            <button type="button" aria-label="Kullanıcı ekleme penceresini kapat" onClick={() => { setCreateUserOpen(false); setShowTemporaryPassword(false); }} disabled={isCreatingUser}><Icon name="close" /></button>
          </header>
          <form className={styles.createUserForm} onSubmit={handleCreateUser}>
            <p id="create-user-description">Kullanıcıya e-posta doğrulama bağlantısı gönderilir. Adresini doğruladıktan sonra geçici şifresiyle giriş yapıp kendi şifresini belirler.</p>
            <label><span>Ad Soyad</span><input name="name" required minLength={2} maxLength={80} autoComplete="off" placeholder="Kullanıcının adı ve soyadı" disabled={isCreatingUser} /></label>
            <label><span>E-posta</span><input name="email" type="email" required autoComplete="off" placeholder="ornek@humanum.com" disabled={isCreatingUser} /></label>
            <label><span>Geçici Şifre</span><span className={styles.passwordField}><input name="password" type={showTemporaryPassword ? "text" : "password"} required minLength={10} maxLength={128} autoComplete="new-password" placeholder="En az 10 karakter" disabled={isCreatingUser} /><button type="button" className={styles.passwordToggle} aria-label={showTemporaryPassword ? "Geçici şifreyi gizle" : "Geçici şifreyi göster"} aria-pressed={showTemporaryPassword} onClick={() => setShowTemporaryPassword((visible) => !visible)} disabled={isCreatingUser}><Icon name="eye" /></button></span><small className={styles.passwordHint}>En az 10 karakter kullanın. Bu şifre yalnızca ilk giriş içindir.</small></label>
            <div className={styles.createUserActions}><button type="button" onClick={() => { setCreateUserOpen(false); setShowTemporaryPassword(false); }} disabled={isCreatingUser}>Vazgeç</button><button type="submit" disabled={isCreatingUser}>{isCreatingUser ? "Ekleniyor..." : "Kullanıcıyı Ekle"}</button></div>
          </form>
        </section>
      </div>}

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
          <button className={styles.menuButton} type="button" aria-label="Menüyü aç" onClick={() => setSidebarOpen(true)}>
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
                  {notifications.map((notification) => {
                    const reminderTarget = encodeURIComponent(notification.id);
                    return <Link className={styles.notificationLink} href={`/hatirlatmalar?reminder=${reminderTarget}#reminder-${reminderTarget}`} onClick={() => setOpenMenu(null)} key={notification.id}>
                    <b>{notification.title}{notification.status === "FAILED" ? " · Gönderim başarısız" : ""}</b>
                    <small>{notification.referenceNumber} · {formatNotificationDate(notification.dueAt)}</small>
                    </Link>;
                  })}
                  <Link className={styles.allNotificationsLink} href="/hatirlatmalar" onClick={() => setOpenMenu(null)}>Tüm bildirimleri göster <span>→</span></Link>
                </div>
              )}
            </div>}

            <div className={styles.menuWrapper}>
              <button className={styles.profileButton} type="button" aria-expanded={openMenu === "profile"} onClick={() => setOpenMenu((value) => value === "profile" ? null : "profile")}>
                <span className={styles.avatar}>{currentUser.initials}</span>
                <span className={styles.profileText}><strong title={currentUser.name}>{currentUser.name}</strong><small>{currentUser.role}</small></span>
                <Icon name="chevron" />
              </button>
              {openMenu === "profile" && (
                <div className={`${styles.popover} ${styles.profilePopover}`}>
                  <p><b>{currentUser.fullName}</b><small>{currentUser.email}</small></p>
                  <Link className={styles.profileAction} href="/sifre-degistir" onClick={() => setOpenMenu(null)}><Icon name="key" /> Şifremi Değiştir</Link>
                  {currentUser.isManager && <button className={styles.profileAction} type="button" onClick={() => {
                    setOpenMenu(null);
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
