import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import ApplicationForm from './ApplicationForm'

export default async function LayananDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const session = await verifySession()

  if (session?.role !== 'WARGA' && session?.role !== 'CITIZEN') {
    redirect('/403')
  }

  const { id } = await params;
  
  const service = await prisma.service.findUnique({
    where: { id: id }
  })

  if (!service) {
    return <div>Layanan tidak ditemukan.</div>
  }

  const requirements = JSON.parse(service.requirements) as string[]

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#ffffff', fontWeight: 800 }}>{service.name}</h1>
        <p style={{ color: '#ffffff', opacity: 0.95, margin: 0, fontWeight: 500 }}>{service.description}</p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Formulir Pengajuan</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Silakan unggah dokumen persyaratan yang diminta. Pastikan file jelas dan ukurannya maksimal 5MB.
        </p>

        <ApplicationForm serviceId={service.id} requirements={requirements} />
      </div>
    </div>
  )
}
