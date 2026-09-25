"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { buildNewUserEnrollment } from "@/lib/new-user-enrollment";
import styles from "./AppShell.module.css";

type IconName =
  | "bell"
  | "briefcase"
  | "camera"
  | "chevron"
  | "close"
  | "folder"
  | "home"
  | "key"
  | "logout"
  | "menu"
  | "plus"
  | "users";

type AppShellProps = {
  children: ReactNode;
  headerContent?: ReactNode;
  hideTopbar?: boolean;
  pageTitle?: string;
  pageSubtitle?: string;
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
    camera: <><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3Z" /><circle cx="12" cy="13" r="3.5" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M15 8l3 3M13 10l3 3" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
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

function UserAvatar({ image, initials, name }: { image?: string | null; initials: string; name: string }) {
  return <span className={styles.avatar} aria-label={`${name} profil fotoğrafı`}>
    {image
      ? <Image className={styles.avatarImage} src={image} alt="" width={40} height={40} unoptimized />
      : initials}
  </span>;
}

function getPageIdentity(pathname: string) {
  if (pathname.startsWith("/sigorta-ve-tahkim/yeni")) return { title: "Yeni Dosya", subtitle: "Sigorta ve Tahkim" };
  if (pathname.startsWith("/sigorta-ve-tahkim")) return { title: "Sigorta ve Tahkim", subtitle: "Dosya Yönetimi" };
  if (pathname.startsWith("/dosyalarim/yeni")) return { title: "Yeni Dosya Kaydı", subtitle: "İcra" };
  if (pathname.startsWith("/dosyalarim")) return { title: "İcra", subtitle: "Dosya Yönetimi" };
  if (pathname.startsWith("/genel-dava-ve-arabuluculuk/yeni")) return { title: "Yeni Dosya Ekle", subtitle: "Genel Dava ve Arabuluculuk" };
  if (pathname.startsWith("/genel-dava-ve-arabuluculuk")) return { title: "Genel Dava ve Arabuluculuk", subtitle: "Dosya Yönetimi" };
  if (pathname.startsWith("/hatirlatmalar")) return { title: "Hatırlatmalar", subtitle: "Görev ve Bildirimler" };
  return { title: "Dashboard", subtitle: "Genel Bakış" };
}

export default function AppShell({ children, headerContent, hideTopbar = false, pageTitle, pageSubtitle }: AppShellProps) {
  const pathname = usePathname();
  const routeIdentity = getPageIdentity(pathname);
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const displayName = session?.user.name || "Kullanıcı";
  const isManager = session?.user.role === "admin";
  const currentUser = {
    initials: getInitials(displayName),
    name: displayName,
    fullName: displayName,
    email: session?.user.email ?? "",
    image: session?.user.image ?? null,
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
  const [changingUserId, setChangingUserId] = useState<string | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<TeamMember | null>(null);
  const [pendingUserDeletion, setPendingUserDeletion] = useState<TeamMember | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [openMenu, setOpenMenu] = useState<"notifications" | "profile" | null>(null);
  const [avatarImageOverride, setAvatarImageOverride] = useState<string | null | undefined>(undefined);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationState, setNotificationState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const menuAreaRef = useRef<HTMLDivElement>(null);
  const teamAreaRef = useRef<HTMLDivElement>(null);
  const profileImageInputRef = useRef<HTMLInputElement>(null);

  const avatarImage = avatarImageOverride === undefined ? currentUser.image : avatarImageOverride;

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
    const [{ data, error }, deletionResponse] = await Promise.all([
      authClient.admin.listUsers({ query: { limit: 50, sortBy: "name", sortDirection: "asc" } }),
      fetch("/api/admin/users/deletion", { credentials: "same-origin", cache: "no-store" }),
    ]);

    if (error || !data) {
      setTeamState("error");
      setManagementNotice("Kullanıcı listesi yüklenemedi. Lütfen tekrar deneyin.");
      return;
    }

    const deletionBody = await deletionResponse.json() as { data?: { userIds?: string[] } };
    const deletedIds = new Set(deletionResponse.ok ? deletionBody.data?.userIds ?? [] : []);
    setTeamMembers(data.users.filter((user) => !deletedIds.has(user.id)));
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
    const enrollment = buildNewUserEnrollment({ name: String(formData.get("name") ?? ""), email });
    const { error } = await authClient.admin.createUser(enrollment.account);

    if (error) {
      setManagementNotice(error.status === 422 || error.status === 400
        ? "Bilgiler geçersiz veya bu e-posta adresi zaten kullanılıyor."
        : "Kullanıcı oluşturulamadı. Lütfen tekrar deneyin.");
      setIsCreatingUser(false);
      return;
    }

    const verification = await authClient.sendVerificationEmail(enrollment.verification);

    form.reset();
    setCreateUserOpen(false);
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

  async function resendVerificationEmail(member: TeamMember) {
    setChangingUserId(member.id);
    setManagementNotice("");
    try {
      const { error } = await authClient.sendVerificationEmail({ email: member.email, callbackURL: "/sifremi-unuttum" });
      setManagementNotice(error
        ? "Doğrulama e-postası gönderilemedi. Lütfen biraz sonra tekrar deneyin."
        : `${member.name} için doğrulama e-postası yeniden gönderildi.`);
    } catch {
      setManagementNotice("Doğrulama e-postası gönderilemedi. Lütfen biraz sonra tekrar deneyin.");
    } finally {
      setChangingUserId(null);
    }
  }

  async function confirmUserDeletion() {
    if (!pendingUserDeletion) return;
    const member = pendingUserDeletion; setPendingUserDeletion(null); setChangingUserId(member.id); setManagementNotice("");
    try {
      const response = await fetch("/api/admin/users/deletion", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ userId: member.id }) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) { setManagementNotice(result.error?.message ?? "Kullanıcı silinemedi."); return; }
      setManagementNotice(`${member.name} silindi. 30 gün içinde yönetici tarafından geri getirilebilir.`); await loadTeamMembers();
    } catch { setManagementNotice("Kullanıcı silinemedi. Lütfen tekrar deneyin."); }
    finally { setChangingUserId(null); }
  }

  async function handleSignOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function handleProfileImageChange(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    event.target.value = "";
    if (!image || isUpdatingAvatar) return;

    if (!(["image/jpeg", "image/png", "image/webp"].includes(image.type)) || image.size > 1024 * 1024) {
      setProfileNotice("JPG, PNG veya WEBP biçiminde, en fazla 1 MB bir fotoğraf seçin.");
      return;
    }

    setIsUpdatingAvatar(true);
    setProfileNotice("");
    try {
      const formData = new FormData();
      formData.set("image", image);
      const response = await fetch("/api/profile/image", { method: "POST", credentials: "same-origin", body: formData });
      const result = await response.json() as { data?: { image: string }; error?: { message?: string } };
      if (!response.ok || !result.data?.image) throw new Error(result.error?.message ?? "Profil fotoğrafı kaydedilemedi.");
      setAvatarImageOverride(result.data.image);
      setProfileNotice("Profil fotoğrafı güncellendi.");
      router.refresh();
    } catch (error) {
      setProfileNotice(error instanceof Error ? error.message : "Profil fotoğrafı kaydedilemedi.");
    } finally {
      setIsUpdatingAvatar(false);
    }
  }

  async function handleProfileImageRemove() {
    if (isUpdatingAvatar) return;
    setIsUpdatingAvatar(true);
    setProfileNotice("");
    try {
      const response = await fetch("/api/profile/image", { method: "DELETE", credentials: "same-origin" });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Profil fotoğrafı kaldırılamadı.");
      setAvatarImageOverride(null);
      setProfileNotice("Profil fotoğrafı kaldırıldı; baş harfler gösteriliyor.");
      router.refresh();
    } catch (error) {
      setProfileNotice(error instanceof Error ? error.message : "Profil fotoğrafı kaldırılamadı.");
    } finally {
      setIsUpdatingAvatar(false);
    }
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
          <Link className={styles.navItem + " " + (pathname.startsWith("/sigorta-ve-tahkim") ? styles.navItemActive : "")} href="/sigorta-ve-tahkim" onClick={() => { setSidebarOpen(false); setTeamOpen(false); }}>
            <Icon name="briefcase" /><span>Sigorta ve Tahkim</span>
          </Link>
          <Link className={styles.navItem + " " + (pathname.startsWith("/dosyalarim") ? styles.navItemActive : "")} href="/dosyalarim" onClick={() => { setSidebarOpen(false); setTeamOpen(false); }}>
            <Icon name="folder" /><span>İcra</span>
          </Link>
          <Link className={styles.navItem + " " + (pathname.startsWith("/genel-dava-ve-arabuluculuk") ? styles.navItemActive : "")} href="/genel-dava-ve-arabuluculuk" onClick={() => { setSidebarOpen(false); setTeamOpen(false); }}>
            <Icon name="users" /><span>Genel Dava ve Arabuluculuk</span>
          </Link>
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
                    {member.id !== session?.user.id && <details className={styles.memberActions}>
                      <summary className={styles.memberActionsTrigger} aria-label={`${member.name} için işlemleri aç`}>•••</summary>
                      <div className={styles.memberActionsMenu}>
                        {member.banned
                          ? <><button className={styles.statusButton} type="button" onClick={() => setPendingUserDeletion(member)} disabled={changingUserId !== null}>{changingUserId === member.id ? "İşleniyor…" : "Kullanıcıyı sil"}</button><button className={styles.reactivateButton} type="button" onClick={() => void applyUserStatusChange(member, "unban")} disabled={changingUserId !== null}>Tekrar aktifleştir</button></>
                          : <>{!member.emailVerified && <button className={styles.reactivateButton} type="button" onClick={() => void resendVerificationEmail(member)} disabled={changingUserId !== null}>{changingUserId === member.id ? "Gönderiliyor…" : "Doğrulama e-postasını gönder"}</button>}<button className={styles.statusButton} type="button" onClick={() => void handleUserStatusChange(member)} disabled={changingUserId !== null}>Kullanıcıyı pasifleştir</button></>}
                      </div>
                    </details>}
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
            <UserAvatar image={avatarImage} initials={currentUser.initials} name={currentUser.name} />
            <span className={styles.sidebarUserText}><strong title={currentUser.name}>{currentUser.name}</strong><small>{currentUser.role}</small></span>
            {currentUser.isManager && <span className={`${styles.teamChevron} ${teamOpen ? styles.teamChevronOpen : ""}`}><Icon name="chevron" /></span>}
          </button>
          <button className={styles.logoutLink} type="button" onClick={handleSignOut} disabled={isSigningOut}><Icon name="logout" /><span>{isSigningOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}</span></button>
        </div>
      </aside>

      {currentUser.isManager && teamOpen && <button className={styles.teamBackdrop} type="button" aria-label="Ekip panelini kapat" onClick={() => setTeamOpen(false)} />}
      {sidebarOpen && <button className={styles.backdrop} type="button" aria-label="Menüyü kapat" onClick={() => { setSidebarOpen(false); setTeamOpen(false); }} />}

      {createUserOpen && <div className={styles.userModalBackdrop} role="presentation" onMouseDown={() => { if (!isCreatingUser) setCreateUserOpen(false); }}>
        <section className={styles.userModal} role="dialog" aria-modal="true" aria-labelledby="create-user-title" aria-describedby="create-user-description" onMouseDown={(event) => event.stopPropagation()}>
          <header className={styles.userModalHeader}>
            <span className={styles.userModalIcon}><Icon name="users" /></span>
            <span><small>Ekip yönetimi</small><h2 id="create-user-title">Yeni kullanıcı ekle</h2></span>
            <button type="button" aria-label="Kullanıcı ekleme penceresini kapat" onClick={() => setCreateUserOpen(false)} disabled={isCreatingUser}><Icon name="close" /></button>
          </header>
          <form className={styles.createUserForm} onSubmit={handleCreateUser}>
            <p id="create-user-description">Kullanıcıya e-posta doğrulama bağlantısı gönderilir. Adresini doğruladıktan sonra yalnızca kendi e-postasına gelen yenileme bağlantısıyla ilk şifresini belirler.</p>
            <label><span>Ad Soyad</span><input name="name" required minLength={2} maxLength={80} autoComplete="off" placeholder="Kullanıcının adı ve soyadı" disabled={isCreatingUser} /></label>
            <label><span>E-posta</span><input name="email" type="email" required autoComplete="off" placeholder="ornek@humanum.com" disabled={isCreatingUser} /></label>
            <div className={styles.createUserActions}><button type="button" onClick={() => setCreateUserOpen(false)} disabled={isCreatingUser}>Vazgeç</button><button type="submit" disabled={isCreatingUser}>{isCreatingUser ? "Ekleniyor..." : "Kullanıcıyı Ekle"}</button></div>
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

      {pendingUserDeletion && <div className={styles.confirmationBackdrop} role="presentation" onMouseDown={() => setPendingUserDeletion(null)}><section className={styles.confirmationDialog} role="dialog" aria-modal="true" aria-labelledby="user-deletion-title" onMouseDown={(event) => event.stopPropagation()}><p className={styles.confirmationEyebrow}>Geri alınabilir silme</p><h2 id="user-deletion-title">Kullanıcı silinsin mi?</h2><p><strong>{pendingUserDeletion.name}</strong> ekip listesinden hemen kaldırılacak. Hesap 30 gün boyunca geri getirilebilir; ardından kişisel giriş bilgileri kalıcı olarak anonimleştirilir.</p><div className={styles.confirmationActions}><button type="button" onClick={() => setPendingUserDeletion(null)}>Vazgeç</button><button type="button" className={styles.dangerButton} onClick={() => void confirmUserDeletion()}>Eminim, sil</button></div></section></div>}

      <div className={`${styles.workspace} ${hideTopbar ? styles.workspaceWithoutTopbar : ""}`}>
        {!hideTopbar && <header className={styles.topbar}>
          <button className={styles.menuButton} type="button" aria-label="Menüyü aç" onClick={() => setSidebarOpen(true)}>
            <Icon name="menu" />
          </button>

          <div className={styles.pageIdentity}>
            <span>{pageSubtitle ?? routeIdentity.subtitle}</span>
            <h1>{pageTitle ?? routeIdentity.title}</h1>
          </div>

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
                <UserAvatar image={avatarImage} initials={currentUser.initials} name={currentUser.name} />
                <span className={styles.profileText}><strong title={currentUser.name}>{currentUser.name}</strong><small>{currentUser.role}</small></span>
                <Icon name="chevron" />
              </button>
              {openMenu === "profile" && (
                <div className={`${styles.popover} ${styles.profilePopover}`}>
                  <p><b>{currentUser.fullName}</b><small>{currentUser.email}</small></p>
                  <input ref={profileImageInputRef} className={styles.profileImageInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileImageChange} />
                  <button className={styles.profileAction} type="button" onClick={() => profileImageInputRef.current?.click()} disabled={isUpdatingAvatar}><Icon name="camera" /> {avatarImage ? "Fotoğrafı Değiştir" : "Fotoğraf Ekle"}</button>
                  {avatarImage && <button className={`${styles.profileAction} ${styles.profileImageRemove}`} type="button" onClick={() => void handleProfileImageRemove()} disabled={isUpdatingAvatar}><Icon name="close" /> Fotoğrafı Kaldır</button>}
                  {profileNotice && <span className={styles.profileNotice} role="status">{profileNotice}</span>}
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
