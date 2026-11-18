import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import Link from 'next/link'

export default async function DaftarLayananPage() {
  const session = await verifySession()

  if (session?.role !== 'WARGA' && session?.role !== 'CITIZEN') {
    redirect('/403')
  }

  const services = await prisma.service.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      estimatedDays: true,
    },
    orderBy: { name: 'asc' }
  })

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#ffffff', fontWeight: 800 }}>Katalog Layanan Desa</h1>
        <p style={{ color: '#ffffff', opacity: 0.95, margin: 0, fontWeight: 500 }}>
          Pilih jenis layanan administrasi yang ingin Anda ajukan.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {services.map(service => (
          <div key={service.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>{service.name}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', flex: 1 }}>
              {service.description}
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                ⏱ Estimasi: {service.estimatedDays} Hari
              </div>
              <Link 
                href={`/dashboard/warga/layanan/${service.id}`}
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}
              >
                Lihat Detail & Ajukan
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
