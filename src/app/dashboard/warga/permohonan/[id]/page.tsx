import { verifySession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import prisma from '@/lib/db'
import RevisionForm from './RevisionForm'

export default async function PermohonanDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const session = await verifySession()

  if (session?.role !== 'WARGA' && session?.role !== 'CITIZEN') {
    redirect('/403')
  }

  const profile = await prisma.citizenProfile.findUnique({
    where: { userId: session.userId }
  })
  if (!profile) redirect('/403')

  const { id } = await params;
  
  const application = await prisma.serviceApplication.findUnique({
    where: { id: id },
    include: {
      service: true,
      documents: true,
      histories: { orderBy: { createdAt: 'desc' } }
    }
  })

  // Ensure application exists and belongs to the user
  if (!application || application.citizenId !== profile.id) {
    notFound()
  }

  const requirements = JSON.parse(application.service.requirements) as string[]

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Detail Permohonan</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Nomor: <strong>{application.applicationNum}</strong></p>
        </div>
        <span style={{ 
          padding: '0.35rem 1rem', 
          borderRadius: '999px', 
          fontSize: '0.85rem',
          fontWeight: 'bold',
          backgroundColor: application.status === 'COMPLETED' ? '#d1fae5' : '#fee2e2',
          color: application.status === 'COMPLETED' ? '#065f46' : '#991b1b'
        }}>
          {application.status}
        </span>
      </div>

      <div style={{ display: 'grid', gap: '2rem' }}>
        
        {/* Info Layanan */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Layanan</h3>
          <p style={{ fontWeight: 'bold' }}>{application.service.name}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Diajukan pada: {new Date(application.createdAt).toLocaleString('id-ID')}
          </p>
        </div>

        {/* Dokumen yang Diunggah */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Dokumen Syarat</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {application.documents.map(doc => (
              <li key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                <span>{doc.name}</span>
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.9rem' }}>
                  Lihat File
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Revision Required */}
        {application.status === 'REVISION_REQUIRED' && (
          <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid #ef4444', backgroundColor: '#fef2f2' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#b91c1c' }}>Perlu Perbaikan</h3>
            <p style={{ color: '#991b1b', marginBottom: '1.5rem' }}>
              Permohonan Anda ditunda. Catatan dari Staf: <br/>
              <strong>{application.histories[0]?.notes || 'Silakan perbaiki dokumen Anda.'}</strong>
            </p>
            <RevisionForm 
              applicationId={application.id} 
              requirements={requirements} 
              existingDocs={application.documents.map(d => ({ name: d.name, id: d.id }))} 
            />
          </div>
        )}

        {/* Riwayat / Timeline */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Riwayat Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {application.histories.map((hist, idx) => (
              <div key={hist.id} style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                <div style={{ position: 'absolute', left: 0, top: '0.25rem', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: idx === 0 ? 'var(--primary)' : 'var(--text-secondary)' }}></div>
                {idx !== application.histories.length - 1 && (
                  <div style={{ position: 'absolute', left: '4px', top: '15px', width: '2px', height: '100%', backgroundColor: 'var(--border)' }}></div>
                )}
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{hist.statusTo}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {new Date(hist.createdAt).toLocaleString('id-ID')}
                </div>
                {hist.notes && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.9rem', backgroundColor: 'var(--bg-color)', padding: '0.5rem', borderRadius: '4px' }}>
                    {hist.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
