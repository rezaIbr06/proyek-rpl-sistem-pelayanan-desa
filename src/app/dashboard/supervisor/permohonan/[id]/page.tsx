import { verifySession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import prisma from '@/lib/db'

export default async function SupervisorPermohonanDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const session = await verifySession()

  if (!session || (session.role !== 'SUPERVISOR' && session.role !== 'ADMIN')) {
    redirect('/403')
  }

  const { id } = await params;

  const application = await prisma.serviceApplication.findUnique({
    where: { id: id },
    include: {
      service: true,
      documents: true,
      histories: { 
        orderBy: { createdAt: 'desc' }
      },
      citizen: { include: { user: true } }
    }
  })

  if (!application) {
    notFound()
  }

  // Fetch users for histories manually since relation is implicit (changedBy is string)
  const historyUserIds = application.histories.map(h => h.changedBy).filter(Boolean) as string[]
  const users = await prisma.user.findMany({
    where: { id: { in: historyUserIds } }
  })
  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user.name
    return acc
  }, {} as Record<string, string>)


  const p = application.citizen

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#ffffff', fontWeight: 800 }}>Monitoring Permohonan</h1>
          <p style={{ color: '#ffffff', opacity: 0.95, margin: 0, fontWeight: 500 }}>Nomor: <strong>{application.applicationNum}</strong></p>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Data Warga */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Data Pemohon</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Nama</div><div style={{ fontWeight: '500' }}>{p.user.name}</div></div>
            <div><div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>NIK</div><div style={{ fontWeight: '500' }}>{p.nik}</div></div>
            <div><div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kontak</div><div style={{ fontWeight: '500' }}>{p.nomorTelepon}</div></div>
          </div>
        </div>

        {/* Info Layanan & Dokumen */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Layanan & Dokumen</h3>
          <p style={{ fontWeight: 'bold', marginBottom: '1rem' }}>{application.service.name}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {application.documents.map(doc => (
              <li key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <span>{doc.name}</span>
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.9rem' }}>Lihat File</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
        
      {/* Riwayat / Audit Kinerja Staf */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Audit Aktivitas Pemrosesan</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Bagian ini hanya dapat dilihat oleh Supervisor/Admin untuk memonitor siapa yang memproses dokumen ini.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {application.histories.map((hist, idx) => {
            const actorName = hist.changedBy ? (userMap[hist.changedBy] || 'Unknown User') : 'Sistem'
            const isCitizen = hist.changedBy === p.userId
            
            return (
              <div key={hist.id} style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                <div style={{ position: 'absolute', left: 0, top: '0.25rem', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: idx === 0 ? 'var(--primary)' : 'var(--text-secondary)' }}></div>
                {idx !== application.histories.length - 1 && (
                  <div style={{ position: 'absolute', left: '4px', top: '15px', width: '2px', height: '100%', backgroundColor: 'var(--border)' }}></div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                    {hist.statusFrom ? `${hist.statusFrom} ➔ ${hist.statusTo}` : hist.statusTo}
                  </div>
                  <span style={{ fontSize: '0.75rem', backgroundColor: isCitizen ? '#fee2e2' : '#f3e8ff', color: isCitizen ? '#991b1b' : '#6b21a8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                    Oleh: {actorName}
                  </span>
                </div>
                
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {new Date(hist.createdAt).toLocaleString('id-ID')}
                </div>
                
                {hist.notes && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', backgroundColor: 'var(--bg-color)', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid var(--border)' }}>
                    <strong>Catatan:</strong> {hist.notes}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
