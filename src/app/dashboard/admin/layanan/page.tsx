import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import Link from 'next/link'
import { toggleServiceStatus } from '@/app/actions/admin'

export default async function AdminLayananPage() {
  const session = await verifySession()
  if (session?.role !== 'ADMIN') redirect('/403')

  const services = await prisma.service.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      estimatedDays: true,
      isActive: true,
      _count: {
        select: { applications: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', color: '#ffffff', fontWeight: 800 }}>📝 Kelola Layanan Desa</h1>
        <Link 
          href="/dashboard/admin/layanan/create"
          className="header-action-btn"
        >
          <span>➕</span>
          <span>Tambah Layanan Baru</span>
        </Link>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Nama Layanan</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>SLA (Hari)</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Jml. Pengajuan</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {services.map(service => (
              <tr key={service.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '1rem', fontWeight: '500' }}>
                  {service.name}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {service.description.substring(0, 50)}...
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>{service.estimatedDays}</td>
                <td style={{ padding: '1rem' }}>{service._count.applications}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ color: service.isActive ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {service.isActive ? 'Aktif' : 'Non-aktif'}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <form action={async () => {
                    'use server'
                    await toggleServiceStatus(service.id)
                  }}>
                    <button type="submit" style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: service.isActive ? '#fee2e2' : '#d1fae5', color: service.isActive ? '#991b1b' : '#065f46', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      {service.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
