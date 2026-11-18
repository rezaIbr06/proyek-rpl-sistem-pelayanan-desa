import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import Link from 'next/link'

export default async function WargaDashboard() {
  const session = await verifySession()

  if (session?.role !== 'WARGA' && session?.role !== 'CITIZEN') {
    redirect('/403')
  }

  // Get citizen profile
  const profile = await prisma.citizenProfile.findUnique({
    where: { userId: session.userId }
  })

  if (!profile) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Profil Belum Lengkap</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Silakan lengkapi profil Anda terlebih dahulu untuk mengajukan permohonan layanan desa.
        </p>
        <Link 
          href="/dashboard/warga/profil" 
          style={{ 
            backgroundColor: 'var(--primary)', 
            color: '#fff', 
            padding: '0.75rem 1.5rem', 
            borderRadius: '0.375rem',
            fontWeight: 600,
            boxShadow: 'var(--shadow-md)'
          }}
        >
          Lengkapi Profil
        </Link>
      </div>
    )
  }

  // Get stats and recent applications in parallel
  const [total, processing, completed, revision, recent] = await Promise.all([
    prisma.serviceApplication.count({ where: { citizenId: profile.id } }),
    prisma.serviceApplication.count({ 
      where: { citizenId: profile.id, status: { in: ['SUBMITTED', 'VERIFIED', 'PROCESSING'] } } 
    }),
    prisma.serviceApplication.count({ 
      where: { citizenId: profile.id, status: 'COMPLETED' } 
    }),
    prisma.serviceApplication.count({ 
      where: { citizenId: profile.id, status: 'REVISION_REQUIRED' } 
    }),
    prisma.serviceApplication.findMany({
      where: { citizenId: profile.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: { service: true }
    })
  ])

  return (
    <div>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
            Beranda Portal Warga
          </h1>
          <p style={{ color: '#ffffff', opacity: 0.95, margin: '0.25rem 0 0', fontSize: '0.9rem', fontWeight: 500 }}>
            Selamat Datang, <strong>{session.name}</strong>. Pantau dan kelola surat administrasi Anda secara mudah.
          </p>
        </div>
        <Link 
          href="/dashboard/warga/layanan" 
          className="header-action-btn"
        >
          <span>➕</span>
          <span>Ajukan Layanan Baru</span>
        </Link>
      </div>
      
      {/* 4 Argon Statistics Cards with Rounded Gradient Icons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Total Pengajuan */}
        <div className="stat-card">
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Pengajuan
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              {total}
            </div>
          </div>
          <div className="stat-icon icon-shape-primary">
            📁
          </div>
        </div>

        {/* Sedang Diproses */}
        <div className="stat-card">
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Sedang Diproses
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning)', marginTop: '0.25rem' }}>
              {processing}
            </div>
          </div>
          <div className="stat-icon icon-shape-warning">
            ⏳
          </div>
        </div>

        {/* Selesai */}
        <div className="stat-card">
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Selesai
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.25rem' }}>
              {completed}
            </div>
          </div>
          <div className="stat-icon icon-shape-success">
            ✓
          </div>
        </div>

        {/* Perlu Perbaikan */}
        <div className="stat-card">
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Perlu Perbaikan
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger)', marginTop: '0.25rem' }}>
              {revision}
            </div>
          </div>
          <div className="stat-icon icon-shape-danger">
            ⚠️
          </div>
        </div>
      </div>

      {/* Argon Clean Activity Table Card */}
      <div className="argon-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Aktivitas Terbaru
          </h2>
          <Link 
            href="/dashboard/warga/permohonan" 
            style={{ 
              color: 'var(--primary)', 
              fontSize: '0.8rem', 
              fontWeight: 700,
              textDecoration: 'none' 
            }}
          >
            Lihat Semua Permohonan →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Belum ada aktivitas pengajuan layanan.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="argon-table">
              <thead>
                <tr>
                  <th>Jenis Layanan</th>
                  <th>Nomor Registrasi</th>
                  <th>Tanggal Update</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(app => (
                  <tr key={app.id}>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{app.service.name}</strong>
                    </td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {app.applicationNum}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {new Date(app.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ 
                        padding: '0.25rem 0.65rem', 
                        borderRadius: '0.25rem', 
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: 
                          app.status === 'COMPLETED' ? 'rgba(45, 206, 137, 0.15)' :
                          app.status === 'REVISION_REQUIRED' ? 'rgba(245, 54, 92, 0.15)' :
                          app.status === 'PROCESSING' ? 'rgba(251, 99, 64, 0.15)' :
                          'rgba(220, 38, 38, 0.12)',
                        color: 
                          app.status === 'COMPLETED' ? '#16a34a' :
                          app.status === 'REVISION_REQUIRED' ? '#dc2626' :
                          app.status === 'PROCESSING' ? '#ea580c' :
                          '#dc2626'
                      }}>
                        {app.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
