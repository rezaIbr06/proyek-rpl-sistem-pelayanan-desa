import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import Link from 'next/link'

export default async function AdminDashboard() {
  const session = await verifySession()

  if (session?.role !== 'ADMIN') {
    redirect('/403')
  }

  const [usersCount, servicesCount, appsCount, knowledgeCount, recentAudits] = await Promise.all([
    prisma.user.count(),
    prisma.service.count(),
    prisma.serviceApplication.count(),
    prisma.aiKnowledge.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        user: {
          select: { name: true, role: true }
        }
      }
    })
  ])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Administrator System</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Ringkasan master data dan metrik kesehatan sistem.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Total Pengguna</h3>
            <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{usersCount}</p>
          </div>
          <div className="stat-icon icon-shape-primary">
            👥
          </div>
        </div>

        <div className="stat-card">
          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Layanan Aktif</h3>
            <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{servicesCount}</p>
          </div>
          <div className="stat-icon icon-shape-info">
            📝
          </div>
        </div>

        <div className="stat-card">
          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Total Permohonan</h3>
            <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{appsCount}</p>
          </div>
          <div className="stat-icon icon-shape-warning">
            📑
          </div>
        </div>

        <div className="stat-card">
          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Artikel AI (Knowledge)</h3>
            <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{knowledgeCount}</p>
          </div>
          <div className="stat-icon icon-shape-success">
            🧠
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '0.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', color: 'var(--text-primary)' }}>Aktivitas Sistem Terbaru</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentAudits.map(log => (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{log.action}</div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Oleh: <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{log.user ? `${log.user.name} (${log.user.role})` : 'Sistem'}</strong> • {log.entityType} ({log.entityId})
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {new Date(log.createdAt).toLocaleString('id-ID')}
                </div>
              </div>
            ))}
            {recentAudits.length === 0 && <p style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>Belum ada aktivitas.</p>}
          </div>
          
          <Link href="/dashboard/admin/audit" style={{ display: 'inline-block', marginTop: '1.25rem', color: 'var(--danger, #dc2626)', fontWeight: 700, fontSize: '0.9rem' }}>
            Lihat Semua Log Audit →
          </Link>
        </div>
        
        <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '0.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', color: 'var(--text-primary)' }}>Pintasan Manajerial</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <Link href="/dashboard/admin/users" style={{ textDecoration: 'none', padding: '0.9rem 1rem', backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem', transition: 'all 0.15s ease' }}>
              <span>👤</span> <span>Kelola Pengguna</span>
            </Link>
            <Link href="/dashboard/admin/layanan" style={{ textDecoration: 'none', padding: '0.9rem 1rem', backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem', transition: 'all 0.15s ease' }}>
              <span>📄</span> <span>Kelola Layanan</span>
            </Link>
            <Link href="/dashboard/admin/knowledge" style={{ textDecoration: 'none', padding: '0.9rem 1rem', backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem', transition: 'all 0.15s ease' }}>
              <span>🧠</span> <span>Kelola Basis Pengetahuan AI</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
