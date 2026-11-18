import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import Link from 'next/link'
import { toggleUserStatus } from '@/app/actions/admin'

export default async function AdminUsersPage() {
  const session = await verifySession()
  if (session?.role !== 'ADMIN') redirect('/403')

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', color: '#ffffff', fontWeight: 800 }}>👥 Kelola Pengguna</h1>
        <Link 
          href="/dashboard/admin/users/create"
          className="header-action-btn"
        >
          <span>➕</span>
          <span>Tambah Pengguna</span>
        </Link>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Nama</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Email</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Role</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '1rem', fontWeight: '500' }}>{user.name}</td>
                <td style={{ padding: '1rem' }}>{user.email}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: 'var(--bg-color)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ color: user.status === 'ACTIVE' ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {user.status === 'ACTIVE' ? 'Aktif' : 'Non-aktif'}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  {user.id !== session.userId && (
                    <form action={async () => {
                      'use server'
                      await toggleUserStatus(user.id)
                    }}>
                      <button type="submit" style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: user.status === 'ACTIVE' ? '#fee2e2' : '#d1fae5', color: user.status === 'ACTIVE' ? '#991b1b' : '#065f46', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {user.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </form>
                  )}
                  {user.id === session.userId && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tidak dapat diubah</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
