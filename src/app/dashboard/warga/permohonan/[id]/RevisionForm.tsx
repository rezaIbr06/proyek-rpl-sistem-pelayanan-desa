'use client'

import { useState } from 'react'
import { resubmitApplication } from '@/app/actions/application'

export default function RevisionForm({ 
  applicationId, 
  requirements,
  existingDocs
}: { 
  applicationId: string, 
  requirements: string[],
  existingDocs: { name: string, id: string }[] 
}) {
  const [files, setFiles] = useState<{ [key: string]: File | null }>({})
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleFileChange = (reqName: string, file: File | null) => {
    setFiles(prev => ({ ...prev, [reqName]: file }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setUploading(true)

    try {
      const documents: { name: string, url: string }[] = []

      // Only upload new files that were selected
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

      if (documents.length === 0) {
        throw new Error('Anda belum mengunggah dokumen baru apapun untuk diperbaiki.')
      }

      // Submit form
      await resubmitApplication(applicationId, documents)
      setSuccess('Permohonan berhasil diajukan ulang.')

    } catch (err: unknown) {
      setError((err as Error).message || 'Terjadi kesalahan saat menyimpan pengajuan.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fef2f2', color: '#ef4444', borderRadius: '8px', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', color: '#16a34a', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
          {success}
        </div>
      )}

      {requirements.map((req, index) => {
        const isUploadedBefore = existingDocs.some(d => d.name === req)
        
        return (
          <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{req}</label>
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
            {isUploadedBefore && !files[req] && (
              <small style={{ color: 'var(--text-secondary)' }}>Biarkan kosong jika tidak ingin mengubah dokumen lama.</small>
            )}
          </div>
        )
      })}

      <button 
        type="submit" 
        disabled={uploading}
        style={{
          marginTop: '1rem',
          padding: '0.875rem',
          backgroundColor: uploading ? 'var(--text-secondary)' : '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: uploading ? 'not-allowed' : 'pointer'
        }}
      >
        {uploading ? 'Memproses...' : 'Kirim Perbaikan'}
      </button>
    </form>
  )
}
