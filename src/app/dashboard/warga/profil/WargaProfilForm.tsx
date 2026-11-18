'use client'

import { useState } from 'react'
import { updateCitizenProfile } from '@/app/actions/user'

type CitizenProfileData = {
  nik: string
  nomorKk: string
  nomorTelepon: string
  alamat: string
  tempatLahir: string | null
  tanggalLahir: string | null
  jenisKelamin: string | null
  pekerjaan: string | null
  agama: string | null
  areaId?: string | null
  additionalAddress?: string | null
}

export default function WargaProfilForm({
  user,
  profile,
}: {
  user: { name: string; email: string }
  profile: CitizenProfileData
}) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const formData = new FormData(e.currentTarget)
      await updateCitizenProfile(formData)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err: unknown) {
      setError((err as Error).message || 'Gagal menyimpan profil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-panel" style={{ padding: '2rem', maxWidth: '720px' }}>
      {success && (
        <div style={{
          backgroundColor: '#dcfce7',
          color: '#15803d',
          padding: '0.875rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          fontWeight: '600'
        }}>
          ✓ Profil berhasil diperbarui! Nomor WhatsApp Anda sudah siap menerima notifikasi.
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          padding: '0.875rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Akun info (Read only) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Nama Lengkap</label>
            <div style={{ fontWeight: '700', fontSize: '1rem' }}>{user.name}</div>
          </div>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Email</label>
            <div style={{ fontSize: '0.95rem' }}>{user.email}</div>
          </div>
        </div>

        {/* Nomor WhatsApp - Highlighted */}
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          border: '1.5px solid rgba(16, 185, 129, 0.3)'
        }}>
          <label htmlFor="nomorTelepon" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', fontSize: '0.9rem', color: '#10b981', marginBottom: '0.5rem' }}>
            <span>📱 Nomor WhatsApp untuk Notifikasi</span>
            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '99px', backgroundColor: '#10b981', color: 'white' }}>Wajib</span>
          </label>
          <input
            id="nomorTelepon"
            name="nomorTelepon"
            type="tel"
            defaultValue={profile.nomorTelepon}
            placeholder="Contoh: 081234567890 atau 6288222505787"
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-color)',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              fontWeight: '600'
            }}
          />
          <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.4rem', display: 'block' }}>
            Notifikasi status permohonan Anda (diajukan, diproses, disetujui, dll.) akan dikirimkan ke nomor ini via WhatsApp.
          </small>
        </div>

        {/* NIK & No KK */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label htmlFor="nik" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              NIK (16 Digit)
            </label>
            <input
              id="nik"
              name="nik"
              type="text"
              maxLength={16}
              defaultValue={profile.nik}
              placeholder="3201..."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div>
            <label htmlFor="nomorKk" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              Nomor KK
            </label>
            <input
              id="nomorKk"
              name="nomorKk"
              type="text"
              maxLength={16}
              defaultValue={profile.nomorKk}
              placeholder="3201..."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Tempat & Tanggal Lahir */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label htmlFor="tempatLahir" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              Tempat Lahir
            </label>
            <input
              id="tempatLahir"
              name="tempatLahir"
              type="text"
              defaultValue={profile.tempatLahir ?? ''}
              placeholder="Kota kelahiran"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div>
            <label htmlFor="tanggalLahir" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              Tanggal Lahir
            </label>
            <input
              id="tanggalLahir"
              name="tanggalLahir"
              type="date"
              defaultValue={profile.tanggalLahir ? profile.tanggalLahir.split('T')[0] : ''}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Alamat Lengkap */}
        <div>
          <label htmlFor="alamat" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
            Alamat Lengkap
          </label>
          <textarea
            id="alamat"
            name="alamat"
            rows={3}
            defaultValue={profile.alamat}
            placeholder="Nama jalan, RT/RW, Dusun, Desa"
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-color)',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Wilayah / Area & Alamat Tambahan (User Profile) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label htmlFor="areaId" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              Kode / ID Wilayah (RT / RW / Dusun)
            </label>
            <input
              id="areaId"
              name="areaId"
              type="text"
              defaultValue={profile.areaId ?? ''}
              placeholder="Contoh: RW-02 / DUSUN-1"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div>
            <label htmlFor="additionalAddress" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              Alamat Tambahan / Patokan Rumah
            </label>
            <input
              id="additionalAddress"
              name="additionalAddress"
              type="text"
              defaultValue={profile.additionalAddress ?? ''}
              placeholder="Contoh: Depan Masjid Al-Ikhlas"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '0.5rem',
            padding: '0.9rem',
            backgroundColor: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.95rem',
            boxShadow: 'var(--shadow-primary)'
          }}
        >
          {loading ? 'Menyimpan...' : 'Simpan Profil'}
        </button>
      </form>
    </div>
  )
}
