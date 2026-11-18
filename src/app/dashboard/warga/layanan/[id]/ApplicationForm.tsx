'use client'

import { useState } from 'react'
import { submitApplication } from '@/app/actions/application'

export default function ApplicationForm({ serviceId, requirements }: { serviceId: string, requirements: string[] }) {
  const [files, setFiles] = useState<{ [key: string]: File | null }>({})
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = (reqName: string, file: File | null) => {
    setFiles(prev => ({ ...prev, [reqName]: file }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Check if all requirements have files
    const missing = requirements.find(req => !files[req])
    if (missing) {
      setError(`Dokumen "${missing}" wajib diunggah.`)
      return
    }

    setUploading(true)

    try {
      const documents: { name: string, url: string }[] = []

      // Upload each file via API
      for (const req of requirements) {
        const file = files[req]
        if (file) {
          const formData = new FormData()
          formData.append('file', file)
          
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          })

          if (!res.ok) {
            const errData = await res.json()
            throw new Error(errData.error || `Gagal mengunggah ${req}`)
          }

          const data = await res.json()
          documents.push({ name: req, url: data.url })
        }
      }

      // Submit form
      await submitApplication(serviceId, documents)

    } catch (err: unknown) {
      setError((err as Error).message || 'Terjadi kesalahan saat menyimpan pengajuan.')
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fef2f2', color: '#ef4444', borderRadius: '8px', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {requirements.map((req, index) => (
        <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{req} <span style={{ color: '#ef4444' }}>*</span></label>
          <input 
            type="file" 
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => handleFileChange(req, e.target.files ? e.target.files[0] : null)}
            style={{ 
              padding: '0.5rem', 
              border: '1px solid var(--border)', 
              borderRadius: '6px',
              backgroundColor: 'var(--bg-color)'
            }}
          />
          <small style={{ color: 'var(--text-secondary)' }}>Format: PDF, JPG, PNG (Maks 5MB)</small>
        </div>
      ))}

      <button 
        type="submit" 
        disabled={uploading}
        style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: uploading ? 'var(--text-secondary)' : 'var(--primary)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: uploading ? 'not-allowed' : 'pointer'
        }}
      >
        {uploading ? 'Memproses Pengajuan...' : 'Kirim Pengajuan'}
      </button>
    </form>
  )
}
