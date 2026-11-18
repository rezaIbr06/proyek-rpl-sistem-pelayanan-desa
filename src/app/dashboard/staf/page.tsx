import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import Link from 'next/link'
import { Prisma } from '@prisma/client'

export default async function StafDashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await verifySession()

  // Extra backend authorization check (ADMIN can also view)
  if (session?.role !== 'STAF' && session?.role !== 'ADMIN') {
    redirect('/403')
  }

  const params = await searchParams;
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

  // Fetch stats and applications concurrently
  const [newApps, processing, revision, applications] = await Promise.all([
    prisma.serviceApplication.count({ where: { status: 'SUBMITTED' } }),
    prisma.serviceApplication.count({ where: { status: { in: ['VERIFIED', 'PROCESSING'] } } }),
    prisma.serviceApplication.count({ where: { status: 'REVISION_REQUIRED' } }),
    prisma.serviceApplication.findMany({
      where: whereClause,
      select: {
        id: true,
        applicationNum: true,
        status: true,
        updatedAt: true,
        service: {
          select: {
            name: true,
          },
        },
        citizen: {
          select: {
            nik: true,
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Dasbor Staf Pelayanan</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Halo {session.name}, berikut adalah daftar permohonan warga.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Permohonan Baru</h3>
            <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{newApps}</p>
          </div>
          <div className="stat-icon icon-shape-primary">
            📩
          </div>
        </div>
        <div className="stat-card">
          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Diproses / Verifikasi</h3>
            <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{processing}</p>
          </div>
          <div className="stat-icon icon-shape-warning">
            ⚙️
          </div>
        </div>
        <div className="stat-card">
          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Perlu Perbaikan</h3>
            <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{revision}</p>
          </div>
          <div className="stat-icon icon-shape-danger">
            ⚠️
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Daftar Permohonan</h2>
          
          <form style={{ display: 'flex', gap: '0.5rem' }}>
            <select name="status" defaultValue={statusFilter || ''} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }}>
              <option value="">Semua Status</option>
              <option value="SUBMITTED">Baru (Submitted)</option>
              <option value="VERIFIED">Terverifikasi</option>
              <option value="PROCESSING">Diproses</option>
              <option value="REVISION_REQUIRED">Perbaikan</option>
              <option value="COMPLETED">Selesai</option>
            </select>
            <input 
              type="text" 
              name="search" 
              placeholder="Cari Nama / No. Permohonan" 
              defaultValue={searchFilter || ''}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }}
            />
            <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '6px', border: 'none' }}>Cari</button>
          </form>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Nomor & Tanggal</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Pemohon</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Layanan</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {applications.map(app => (
                <tr key={app.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 'bold' }}>{app.applicationNum}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(app.updatedAt).toLocaleDateString('id-ID')}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 'bold' }}>{app.citizen.user.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>NIK: {app.citizen.nik}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>{app.service.name}</td>
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
                    <Link href={`/dashboard/staf/permohonan/${app.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>
                      Proses
                    </Link>
                  </td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Tidak ada data permohonan yang sesuai kriteria.
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
