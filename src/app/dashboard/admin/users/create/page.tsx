'use client'

import { useState } from 'react'
import { createUser } from '@/app/actions/admin'
import Link from 'next/link'

export default function CreateUserPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      role: formData.get('role') as string,
      nomorTelepon: (formData.get('nomorTelepon') as string)?.trim() ?? '',
    }

    try {
      await createUser(data)
    } catch (err: unknown) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/dashboard/admin/users" className="backLink" style={{ color: '#ffffff', textDecoration: 'none', fontSize: '1.25rem', fontWeight: 'bold' }}>←</Link>
        <h1 style={{ fontSize: '1.75rem', color: '#ffffff', fontWeight: 800 }}>Tambah Pengguna Baru</h1>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {error && <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '8px' }}>{error}</div>}
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Nama Lengkap</label>
            <input name="name" type="text" required style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Alamat Email</label>
            <input name="email" type="email" required style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Password</label>
            <input name="password" type="password" required minLength={6} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Role (Peran)</label>
            <select name="role" required defaultValue="WARGA" style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }}>
              <option value="WARGA">WARGA</option>
              <option value="STAF">STAF</option>
              <option value="SUPERVISOR">SUPERVISOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Nomor WhatsApp (Khusus Warga)</label>
            <input name="nomorTelepon" type="tel" placeholder="Contoh: 081234567890 atau 6288222505787" style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }} />
            <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>Nomor ini digunakan untuk mengirimkan notifikasi status permohonan via WhatsApp.</small>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ padding: '1rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Menyimpan...' : 'Simpan Pengguna'}
          </button>
        </form>
      </div>
    </div>
  )
}
