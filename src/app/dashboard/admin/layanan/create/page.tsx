'use client'

import { useState } from 'react'
import { createService } from '@/app/actions/admin'
import Link from 'next/link'

export default function CreateServicePage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requirements, setRequirements] = useState<string[]>([''])

  const handleReqChange = (index: number, value: string) => {
    const newReqs = [...requirements]
    newReqs[index] = value
    setRequirements(newReqs)
  }

  const addReq = () => setRequirements([...requirements, ''])
  const removeReq = (index: number) => setRequirements(requirements.filter((_, i) => i !== index))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const formData = new FormData(e.currentTarget)
    const validReqs = requirements.filter(r => r.trim() !== '')

    if (validReqs.length === 0) {
      setError('Minimal satu dokumen persyaratan diperlukan.')
      setLoading(false)
      return
    }

    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      estimatedDays: formData.get('estimatedDays') as string,
      requirements: validReqs,
    }

    try {
      await createService(data)
    } catch (err: unknown) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/dashboard/admin/layanan" className="backLink" style={{ color: '#ffffff', textDecoration: 'none', fontSize: '1.25rem', fontWeight: 'bold' }}>←</Link>
        <h1 style={{ fontSize: '1.75rem', color: '#ffffff', fontWeight: 800 }}>Tambah Layanan Desa</h1>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {error && <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '8px' }}>{error}</div>}
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Nama Layanan</label>
            <input name="name" type="text" placeholder="Contoh: Surat Keterangan Domisili" required style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Deskripsi Pendek</label>
            <textarea name="description" rows={3} required style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Estimasi Waktu Proses (Hari)</label>
            <input name="estimatedDays" type="number" min="1" max="30" required defaultValue="3" style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Dokumen Persyaratan</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {requirements.map((req, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    value={req} 
                    onChange={(e) => handleReqChange(index, e.target.value)} 
                    placeholder={`Persyaratan ${index + 1} (Contoh: Scan KTP)`}
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }}
                  />
                  {requirements.length > 1 && (
                    <button type="button" onClick={() => removeReq(index)} style={{ padding: '0 1rem', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Hapus</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addReq} style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', border: '1px solid var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>+ Tambah Syarat</button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Menyimpan...' : 'Simpan Layanan'}
          </button>
        </form>
      </div>
    </div>
  )
}
