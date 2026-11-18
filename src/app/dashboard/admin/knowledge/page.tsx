import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import Link from 'next/link'
import { toggleKnowledgeStatus } from '@/app/actions/admin'

export default async function AdminKnowledgePage() {
  const session = await verifySession()
  if (session?.role !== 'ADMIN') redirect('/403')

  const knowledges = await prisma.aiKnowledge.findMany({
    select: {
      id: true,
      title: true,
      category: true,
      updatedAt: true,
      status: true,
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', color: '#ffffff', fontWeight: 800 }}>🧠 Basis Pengetahuan AI</h1>
        <Link 
          href="/dashboard/admin/knowledge/create"
          className="header-action-btn"
        >
          <span>➕</span>
          <span>Tambah Pengetahuan</span>
        </Link>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Judul Info</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Kategori</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Tgl Update</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {knowledges.map(kn => (
              <tr key={kn.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '1rem', fontWeight: '500' }}>
                  {kn.title}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: 'var(--bg-color)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    {kn.category || 'Umum'}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>{new Date(kn.updatedAt).toLocaleDateString('id-ID')}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ color: kn.status === 'PUBLISHED' ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {kn.status}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <form action={async () => {
                    'use server'
                    await toggleKnowledgeStatus(kn.id)
                  }}>
                    <button type="submit" style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: kn.status === 'PUBLISHED' ? '#fee2e2' : '#d1fae5', color: kn.status === 'PUBLISHED' ? '#991b1b' : '#065f46', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      {kn.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
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
