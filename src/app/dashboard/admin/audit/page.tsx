import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'

export default async function AdminAuditPage() {
  const session = await verifySession()
  if (session?.role !== 'ADMIN') redirect('/403')

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        }
      }
    }
  })

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', color: '#ffffff', fontWeight: 800 }}>🛡️ Audit Logs Sistem</h1>
        <p style={{ color: '#ffffff', opacity: 0.95, margin: 0, fontWeight: 500 }}>Menampilkan 100 aktivitas terbaru di dalam sistem.</p>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Waktu</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Aktor</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Aksi</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Entitas</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Detail Tambahan</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                  {new Date(log.createdAt).toLocaleString('id-ID')}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: '500' }}>{log.user ? log.user.name : 'Sistem'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{log.user ? log.user.role : '-'}</div>
                </td>
                <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                  {log.action}
                </td>
                <td style={{ padding: '1rem' }}>
                  {log.entityType} <br/> <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({log.entityId})</span>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                  {log.details ? (
                    <pre style={{ margin: 0, padding: '0.5rem', backgroundColor: 'var(--bg-color)', borderRadius: '4px', overflowX: 'auto', maxWidth: '300px' }}>
                      {log.details}
                    </pre>
                  ) : '-'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Belum ada rekaman audit.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
