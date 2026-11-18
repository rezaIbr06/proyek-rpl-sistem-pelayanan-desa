'use client'

import { useState } from 'react'
import { createKnowledge } from '@/app/actions/admin'
import Link from 'next/link'

export default function CreateKnowledgePage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const formData = new FormData(e.currentTarget)
    const data = {
      title: formData.get('title') as string,
      category: formData.get('category') as string,
      content: formData.get('content') as string,
      source: formData.get('source') as string,
    }

    try {
      await createKnowledge(data)
    } catch (err: unknown) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/dashboard/admin/knowledge" className="backLink" style={{ color: '#ffffff', textDecoration: 'none', fontSize: '1.25rem', fontWeight: 'bold' }}>←</Link>
        <h1 style={{ fontSize: '1.75rem', color: '#ffffff', fontWeight: 800 }}>Tambah Basis Pengetahuan</h1>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {error && <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '8px' }}>{error}</div>}
          
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Judul Informasi</label>
              <input name="title" type="text" placeholder="Cth: Jadwal Pelayanan Balai Desa" required style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Kategori</label>
              <select name="category" required style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }}>
                <option value="Jadwal">Jadwal</option>
                <option value="Syarat Layanan">Syarat Layanan</option>
                <option value="Pengumuman">Pengumuman</option>
                <option value="Bantuan Sosial">Bantuan Sosial</option>
                <option value="Umum">Umum</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Konten / Jawaban (Digunakan oleh AI)</label>
            <textarea name="content" rows={8} placeholder="Tuliskan informasi lengkap yang akan dijawab oleh AI..." required style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)', resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>URL Sumber (Opsional)</label>
            <input name="source" type="url" placeholder="https://..." style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }} />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Menyimpan...' : 'Simpan ke Knowledge Base'}
          </button>
        </form>
      </div>
    </div>
  )
}
