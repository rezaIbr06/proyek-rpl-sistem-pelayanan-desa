import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import Link from 'next/link'
import { Prisma } from '@prisma/client'

export default async function SupervisorDashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await verifySession()

  if (session?.role !== 'SUPERVISOR' && session?.role !== 'ADMIN') {
    redirect('/403')
  }

  const params = await searchParams
  const statusFilter = typeof params.status === 'string' ? params.status : undefined
  const searchFilter = typeof params.search === 'string' ? params.search : undefined

  // Build query
  const whereClause: Prisma.ServiceApplicationWhereInput = {}
  if (statusFilter) whereClause.status = statusFilter
  if (searchFilter) {
    whereClause.OR = [
      { applicationNum: { contains: searchFilter } },
      { citizen: { user: { name: { contains: searchFilter } } } }
    ]
  }

  // Fetch all 7 stats and applications concurrently in parallel
  const [totalApps, newApps, processing, completed, revision, rejected, applications] = await Promise.all([
    prisma.serviceApplication.count(),
    prisma.serviceApplication.count({ where: { status: 'SUBMITTED' } }),
    prisma.serviceApplication.count({ where: { status: { in: ['VERIFIED', 'PROCESSING'] } } }),
    prisma.serviceApplication.count({ where: { status: 'COMPLETED' } }),
    prisma.serviceApplication.count({ where: { status: 'REVISION_REQUIRED' } }),
    prisma.serviceApplication.count({ where: { status: 'REJECTED' } }),
    prisma.serviceApplication.findMany({
      where: whereClause,
      select: {
        id: true,
        applicationNum: true,
        status: true,
        createdAt: true,
        service: {
          select: {
            name: true,
            estimatedDays: true,
          },
        },
        citizen: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' }
    })
  ])

  // Calculate Late Applications (Terlambat)
  // For simplicity, late if current date > createdAt + estimatedDays and status != COMPLETED/REJECTED
  const now = new Date()
  let lateCount = 0
  const applicationsWithLateFlag = applications.map(app => {
    const dueDate = new Date(app.createdAt)
    dueDate.setDate(dueDate.getDate() + app.service.estimatedDays)
    
    const isLate = now > dueDate && app.status !== 'COMPLETED' && app.status !== 'REJECTED'
    if (isLate) lateCount++
    
    return { ...app, isLate, dueDate }
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Monitoring Layanan (Supervisor)</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Pantau performa pelayanan dan antrean permohonan warga.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Total Pengajuan</h3>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{totalApps}</p>
          </div>
          <div className="stat-icon icon-shape-primary">
            📋
          </div>
        </div>
        <div className="stat-card">
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Baru</h3>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{newApps}</p>
          </div>
          <div className="stat-icon icon-shape-info">
            📩
          </div>
        </div>
        <div className="stat-card">
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Diproses</h3>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{processing}</p>
          </div>
          <div className="stat-icon icon-shape-warning">
            ⚙️
          </div>
        </div>
        <div className="stat-card">
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Selesai</h3>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{completed}</p>
          </div>
          <div className="stat-icon icon-shape-success">
            ✅
          </div>
        </div>
        <div className="stat-card">
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Ditolak / Revisi</h3>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{rejected} / {revision}</p>
          </div>
          <div className="stat-icon icon-shape-danger">
            ❌
          </div>
        </div>
        <div className="stat-card" style={{ border: lateCount > 0 ? '1px solid #ef4444' : undefined, backgroundColor: lateCount > 0 ? 'rgba(239, 68, 68, 0.08)' : undefined }}>
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: lateCount > 0 ? 'var(--danger)' : 'var(--text-secondary)', marginBottom: '0.35rem' }}>Terlambat (SLA)</h3>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: lateCount > 0 ? 'var(--danger)' : 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{lateCount}</p>
          </div>
          <div className="stat-icon icon-shape-danger">
            ⏱️
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Monitoring Permohonan</h2>
          
          <form style={{ display: 'flex', gap: '0.5rem' }}>
            <select name="status" defaultValue={statusFilter || ''} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }}>
              <option value="">Semua Status</option>
              <option value="SUBMITTED">Baru</option>
              <option value="PROCESSING">Diproses</option>
              <option value="COMPLETED">Selesai</option>
              <option value="REVISION_REQUIRED">Revisi</option>
            </select>
            <input 
              type="text" 
              name="search" 
              placeholder="Cari..." 
              defaultValue={searchFilter || ''}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }}
            />
            <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '6px', border: 'none' }}>Filter</button>
          </form>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Nomor</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Layanan & Pemohon</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Tenggat Waktu</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {applicationsWithLateFlag.map(app => (
                <tr key={app.id} className={app.isLate ? 'late-row' : ''} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 'bold' }}>{app.applicationNum}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 'bold' }}>{app.service.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{app.citizen.user.name}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div>{app.dueDate.toLocaleDateString('id-ID')}</div>
                    {app.isLate && <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 'bold' }}>TERLEWAT</span>}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: '999px', 
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      backgroundColor: app.status === 'COMPLETED' ? '#d1fae5' : '#fee2e2',
                      color: app.status === 'COMPLETED' ? '#065f46' : '#991b1b'
                    }}>
                      {app.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <Link href={`/dashboard/supervisor/permohonan/${app.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Tidak ada data permohonan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
