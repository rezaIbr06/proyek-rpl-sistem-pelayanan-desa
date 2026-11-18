'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './dashboard.module.css'

type NavLink = {
  href: string;
  label: string;
  icon?: string;
}

export default function SidebarNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname()

  return (
    <nav className={styles.nav}>
      {links.map((link) => {
        const isActive = pathname === link.href || (pathname.startsWith(link.href + '/') && link.href !== '/dashboard/warga' && link.href !== '/dashboard/admin')

        return (
          <Link 
            key={link.href} 
            href={link.href} 
            className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            {link.icon && (
              <span style={{ fontSize: '1.15rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px' }}>
                {link.icon}
              </span>
            )}
            <span>{link.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
