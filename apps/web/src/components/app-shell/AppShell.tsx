"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
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
  | "users";

type AppShellProps = {
  children: ReactNode;
  headerContent?: ReactNode;
  hideTopbar?: boolean;
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
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  };

  return <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function AppShell({ children, headerContent, hideTopbar = false }: AppShellProps) {
  const pathname = usePathname();
  // Gerçek kullanıcı ve ekip bilgileri güvenli oturumdan gelecek.
  const currentUser = { initials: "MY", name: "Mehmet Y.", fullName: "Mehmet Yılmaz", role: "Yönetici", isManager: true };
  const teamMembers = [
    { initials: "AY", name: "Ayşe Y.", role: "Kullanıcı" },
    { initials: "BK", name: "Burak K.", role: "Kullanıcı" },
    { initials: "SD", name: "Selin D.", role: "Kullanıcı" },
  ];
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [managementNotice, setManagementNotice] = useState(false);
  const [openMenu, setOpenMenu] = useState<"notifications" | "profile" | null>(null);
  const menuAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      if (!menuAreaRef.current?.contains(event.target as Node)) setOpenMenu(null);
    }

    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

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
              <div className={styles.teamPanelHeader}><strong>Ekip</strong><span>{teamMembers.length} kişi</span></div>
              {teamMembers.map((member) => (
                <div className={styles.teamMember} key={member.name}>
                  <span className={styles.memberAvatar}>{member.initials}</span>
                  <span><strong>{member.name}</strong><small>{member.role}</small></span>
                </div>
              ))}
              <button className={styles.addMemberButton} type="button" onClick={() => setManagementNotice(true)}><Icon name="plus" />Yeni kullanıcı ekle</button>
              {managementNotice && <p className={styles.managementNotice} role="status">Kullanıcı ekleme formu, güvenli kullanıcı yönetimi aşamasında bağlanacak.</p>}
            </div>
          )}
          <button className={styles.sidebarUser} type="button" aria-expanded={teamOpen} onClick={() => {
            if (sidebarCollapsed) setSidebarCollapsed(false);
            if (currentUser.isManager) setTeamOpen((value) => !value);
          }}>
            <span className={styles.avatar}>{currentUser.initials}</span>
            <span className={styles.sidebarUserText}><strong>{currentUser.name}</strong><small>{currentUser.role}</small></span>
            {currentUser.isManager && <span className={`${styles.teamChevron} ${teamOpen ? styles.teamChevronOpen : ""}`}><Icon name="chevron" /></span>}
          </button>
          <Link className={styles.logoutLink} href="/login"><Icon name="logout" /><span>Çıkış Yap</span></Link>
        </div>
      </aside>

      {sidebarOpen && <button className={styles.backdrop} type="button" aria-label="Menüyü kapat" onClick={() => setSidebarOpen(false)} />}

      <div className={`${styles.workspace} ${hideTopbar ? styles.workspaceWithoutTopbar : ""}`}>
        {!hideTopbar && <header className={styles.topbar}>
          <button className={styles.menuButton} type="button" aria-label="Menüyü aç veya daralt" onClick={() => window.innerWidth < 900 ? setSidebarOpen(true) : setSidebarCollapsed((value) => !value)}>
            <Icon name="menu" />
          </button>

          {headerContent && <div className={styles.headerContent}>{headerContent}</div>}

          <div className={styles.topbarMenus} ref={menuAreaRef}>
            {currentUser.isManager && <div className={styles.menuWrapper}>
              <button className={styles.notificationButton} type="button" aria-label="Bildirimler" aria-expanded={openMenu === "notifications"} onClick={() => setOpenMenu((value) => value === "notifications" ? null : "notifications")}>
                <Icon name="bell" /><span className={styles.notificationCount}>3</span>
              </button>
              {openMenu === "notifications" && (
                <div className={styles.popover}>
                  <div className={styles.popoverHeader}><strong>Bildirimler</strong><span>3 yeni</span></div>
                  <p><b>ABC Sigorta</b><small>Takım duruşması yarın 10:30’da.</small></p>
                  <p><b>XYZ A.Ş.</b><small>İcra takibi için yeni hatırlatma.</small></p>
                  <p><b>Dosya güncellendi</b><small>34 ABC 123 numaralı dosya düzenlendi.</small></p>
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
                  <p><b>{currentUser.fullName}</b><small>mehmet@humanumhukuk.com</small></p>
                  {currentUser.isManager && <button className={styles.profileAction} type="button" onClick={() => {
                    setOpenMenu(null);
                    setSidebarCollapsed(false);
                    setSidebarOpen(true);
                    setTeamOpen(true);
                  }}><Icon name="users" /> Kullanıcı Yönetimi</button>}
                  <Link href="/login"><Icon name="logout" /> Çıkış Yap</Link>
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
