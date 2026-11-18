'use client'

import { useState } from 'react'
import { updateApplicationStatus } from '@/app/actions/staff'

export default function StatusForm({ applicationId, currentStatus }: { applicationId: string, currentStatus: string }) {
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!status) return

    if ((status === 'REVISION_REQUIRED' || status === 'REJECTED') && !notes) {
      setError('Catatan wajib diisi untuk penolakan atau permintaan revisi.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await updateApplicationStatus(applicationId, status, notes)
      setStatus('')
      setNotes('')
    } catch (err: unknown) {
      setError((err as Error).message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  // Define allowed transitions based on current status
  const allowedOptions = []
  if (currentStatus === 'SUBMITTED') {
    allowedOptions.push({ value: 'VERIFIED', label: 'Verifikasi Dokumen' })
    allowedOptions.push({ value: 'REVISION_REQUIRED', label: 'Minta Perbaikan (Revisi)' })
    allowedOptions.push({ value: 'REJECTED', label: 'Tolak Permohonan' })
  } else if (currentStatus === 'VERIFIED') {
    allowedOptions.push({ value: 'PROCESSING', label: 'Mulai Proses Layanan' })
    allowedOptions.push({ value: 'REJECTED', label: 'Tolak Permohonan' })
  } else if (currentStatus === 'PROCESSING') {
    allowedOptions.push({ value: 'COMPLETED', label: 'Selesaikan Permohonan' })
  }

  if (currentStatus === 'COMPLETED' || currentStatus === 'REJECTED') {
    return <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Permohonan sudah selesai dan tidak dapat diubah lagi.</p>
  }

  if (currentStatus === 'REVISION_REQUIRED') {
    return <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Menunggu perbaikan dokumen dari Warga.</p>
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', color: '#ef4444', borderRadius: '6px', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
          Ubah Status Menjadi
        </label>
        <select 
          value={status} 
          onChange={(e) => setStatus(e.target.value)}
          required
          style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }}
        >
          <option value="" disabled>-- Pilih Tindakan --</option>
          {allowedOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {(status === 'REVISION_REQUIRED' || status === 'REJECTED' || status === 'COMPLETED') && (
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
            Catatan Tambahan {(status === 'REVISION_REQUIRED' || status === 'REJECTED') && <span style={{ color: '#ef4444' }}>*</span>}
          </label>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder={status === 'REVISION_REQUIRED' ? 'Contoh: KTP buram, harap upload ulang' : 'Catatan opsional'}
            required={status === 'REVISION_REQUIRED' || status === 'REJECTED'}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)', resize: 'vertical' }}
          />
        </div>
      )}

      <button 
        type="submit" 
        disabled={loading || !status}
        style={{
          padding: '0.875rem',
          backgroundColor: status === 'REJECTED' ? '#ef4444' : 'var(--primary)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: (loading || !status) ? 'not-allowed' : 'pointer',
          opacity: (loading || !status) ? 0.7 : 1
        }}
      >
        {loading ? 'Menyimpan...' : 'Perbarui Status'}
      </button>
    </form>
  )
}
