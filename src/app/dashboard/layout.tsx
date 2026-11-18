import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import NotificationBell from '@/components/NotificationBell'
import ThemeToggle from '@/components/ThemeToggle'
import AiAssistantWrapper from '@/components/AiAssistantWrapper'
import SidebarNav from './SidebarNav'
import styles from './dashboard.module.css'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifySession()

  // Redirect just in case middleware fails or is bypassed
  if (!session) {
    redirect('/login')
  }

  const navLinks = []

  // Sidebar link generation based on role with icons
  if (session.role === 'WARGA' || session.role === 'CITIZEN') {
    navLinks.push(
      { href: '/dashboard/warga', label: 'Beranda', icon: '🏠' },
      { href: '/dashboard/warga/permohonan', label: 'Permohonan Saya', icon: '📑' },
      { href: '/dashboard/warga/profil', label: 'Profil Warga', icon: '👤' }
    )
  } else if (session.role === 'STAF') {
    navLinks.push(
      { href: '/dashboard/staf', label: 'Dashboard Staf', icon: '📊' }
    )
  } else if (session.role === 'SUPERVISOR') {
    navLinks.push(
      { href: '/dashboard/supervisor', label: 'Dashboard Supervisor', icon: '👁️' }
    )
  } else if (session.role === 'ADMIN') {
    navLinks.push(
      { href: '/dashboard/admin', label: 'Dashboard Admin', icon: '⚡' },
      { href: '/dashboard/admin/users', label: 'Kelola Pengguna', icon: '👥' },
      { href: '/dashboard/admin/layanan', label: 'Kelola Layanan', icon: '📝' },
      { href: '/dashboard/admin/notifikasi', label: 'Monitoring Notifikasi', icon: '🔔' },
      { href: '/dashboard/admin/konfigurasi-wa', label: 'Konfigurasi WhatsApp', icon: '📱' },
      { href: '/dashboard/admin/knowledge', label: 'Knowledge Base AI', icon: '🧠' },
      { href: '/dashboard/admin/konfigurasi-ai', label: 'Konfigurasi AI', icon: '⚙️' },
      { href: '/dashboard/admin/audit', label: 'Audit Logs', icon: '🛡️' }
    )
  }

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>
            <span>🏘️</span>
            <span>Desa AI</span>
          </h3>
          <span className={styles.roleBadge}>{session.role}</span>
        </div>

        <SidebarNav links={navLinks} />

        <div className={styles.sidebarFooter}>
          {/* 2 Display Modes Switcher (Terang / Gelap) */}
          <div className={styles.themeToggleSection}>
            <ThemeToggle variant="segmented" />
          </div>

          <div className={styles.userInfo}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              <span style={{ fontSize: '1.1rem' }}>👤</span>
              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.name}</strong>
            </div>
          </div>
          <form action={logout}>
            <button type="submit" className={styles.logoutBtn} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <span>🚪</span>
              <span>Keluar</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Argon Iconic Header Gradient */}
        <div className={styles.argonHeaderContainer}>
          <header className={styles.topHeader}>
            <div className={styles.portalBadge}>
              <span className={styles.portalDot}></span>
              <span>Sistem Pelayanan Terpadu Desa</span>
            </div>
            <div className={styles.headerActions}>
              <NotificationBell />
              <ThemeToggle variant="icon" />
            </div>
          </header>
        </div>

        {/* Content Body Floating Over Gradient */}
        <div className={styles.contentBody}>
          {children}
        </div>
      </main>
      <AiAssistantWrapper />
    </div>
  )
}
