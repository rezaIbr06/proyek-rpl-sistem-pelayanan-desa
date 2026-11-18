import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import Link from 'next/link'

export default async function DaftarPermohonanPage() {
  const session = await verifySession()

  if (session?.role !== 'WARGA' && session?.role !== 'CITIZEN') {
    redirect('/403')
  }

  const profile = await prisma.citizenProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  })

  if (!profile) {
    redirect('/dashboard/warga')
  }

  const applications = await prisma.serviceApplication.findMany({
    where: { citizenId: profile.id },
    select: {
      id: true,
      applicationNum: true,
      status: true,
      createdAt: true,
      service: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#ffffff', fontWeight: 800 }}>Permohonan Saya</h1>
        <p style={{ color: '#ffffff', opacity: 0.95, margin: 0, fontWeight: 500 }}>
          Riwayat dan status pengajuan layanan administrasi Anda.
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Belum ada permohonan yang diajukan.</p>
          <Link href="/dashboard/warga/layanan" style={{ color: 'var(--primary)', marginTop: '1rem', display: 'inline-block' }}>
            + Buat Pengajuan Baru
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {applications.map(app => (
            <Link 
              href={`/dashboard/warga/permohonan/${app.id}`} 
              key={app.id} 
              className="glass-panel" 
              style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {app.service.name}
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Nomor: <strong>{app.applicationNum}</strong> • {new Date(app.createdAt).toLocaleDateString('id-ID')}
                </div>
              </div>
              <div>
                <span style={{ 
                    padding: '0.35rem 1rem', 
                    borderRadius: '999px', 
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    backgroundColor: app.status === 'COMPLETED' ? '#d1fae5' : '#fee2e2',
                    color: app.status === 'COMPLETED' ? '#065f46' : '#991b1b'
                  }}>
                    {app.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
