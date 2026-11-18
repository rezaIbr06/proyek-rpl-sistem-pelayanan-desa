import { verifySession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import prisma from '@/lib/db'
import StatusForm from './StatusForm'

export default async function StafPermohonanDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const session = await verifySession()

  if (!session || (session.role !== 'STAF' && session.role !== 'ADMIN')) {
    redirect('/403')
  }

  const { id } = await params;

  const application = await prisma.serviceApplication.findUnique({
    where: { id: id },
    include: {
      service: true,
      documents: true,
      histories: { orderBy: { createdAt: 'desc' } },
      citizen: { include: { user: true } }
    }
  })

  if (!application) {
    notFound()
  }

  const p = application.citizen

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
      
      {/* Left Column: Data & Documents */}
      <div>
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#ffffff', fontWeight: 800 }}>Detail Permohonan</h1>
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

        {/* Data Warga */}
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Data Pemohon</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Nama</div>
              <div style={{ fontWeight: '500' }}>{p.user.name}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>NIK / No. KK</div>
              <div style={{ fontWeight: '500' }}>{p.nik} / {p.nomorKk}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tempat, Tgl Lahir</div>
              <div style={{ fontWeight: '500' }}>{p.tempatLahir}, {p.tanggalLahir ? new Date(p.tanggalLahir).toLocaleDateString('id-ID') : '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kontak</div>
              <div style={{ fontWeight: '500' }}>{p.nomorTelepon} | {p.user.email}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Alamat</div>
              <div style={{ fontWeight: '500' }}>{p.alamat}</div>
            </div>
          </div>
        </div>

        {/* Info Layanan & Dokumen */}
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Layanan & Dokumen Syarat</h3>
          <p style={{ fontWeight: 'bold', marginBottom: '1rem' }}>{application.service.name}</p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {application.documents.map(doc => (
              <li key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                <span>{doc.name}</span>
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.9rem' }}>
                  Lihat / Unduh Dokumen
                </a>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Riwayat */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Riwayat Pemrosesan</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {application.histories.map((hist, idx) => (
              <div key={hist.id} style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                <div style={{ position: 'absolute', left: 0, top: '0.25rem', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: idx === 0 ? 'var(--primary)' : 'var(--text-secondary)' }}></div>
                {idx !== application.histories.length - 1 && (
                  <div style={{ position: 'absolute', left: '4px', top: '15px', width: '2px', height: '100%', backgroundColor: 'var(--border)' }}></div>
                )}
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{hist.statusTo}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {new Date(hist.createdAt).toLocaleString('id-ID')} {hist.changedBy === application.citizen.userId ? '(Oleh Warga)' : '(Oleh Staf)'}
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

      {/* Right Column: Actions */}
      <div>
        <div className="glass-panel" style={{ padding: '1.5rem', position: 'sticky', top: '100px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Tindakan Staf</h3>
          <StatusForm applicationId={application.id} currentStatus={application.status} />
        </div>
      </div>

    </div>
  )
}
