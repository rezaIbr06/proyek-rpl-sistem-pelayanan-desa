'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from '../login/login.module.css'
import { handleResetPassword } from '@/app/actions/auth'

export default function ResetPasswordFormClient({ token }: { token: string }) {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Tautan Pemulihan Tidak Lengkap
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Token pemulihan kata sandi tidak ditemukan pada tautan ini. Silakan ajukan permohonan baru.
        </p>
        <Link
          href="/forgot-password"
          className={styles.submitBtn}
          style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
        >
          Minta Tautan Baru
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok dengan kata sandi baru.')
      setLoading(false)
      return
    }

    if (newPassword.length < 8) {
      setErrorMessage('Kata sandi baru minimal 8 karakter.')
      setLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.set('token', token)
      formData.set('newPassword', newPassword)
      formData.set('confirmNewPassword', confirmNewPassword)

      const res = await handleResetPassword(formData)

      if (res.success) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/login?reset=success')
        }, 1500)
      } else {
        setErrorMessage(res.error || 'Gagal mereset kata sandi.')
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Terjadi kesalahan sistem.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎉</div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#16a34a', marginBottom: '0.5rem' }}>
          Kata Sandi Berhasil Diperbarui!
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Mengarahkan Anda ke halaman masuk dalam beberapa detik...
        </p>
        <Link
          href="/login?reset=success"
          className={styles.submitBtn}
          style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
        >
          Masuk Sekarang
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {errorMessage && (
        <div className={styles.errorAlert} style={{ marginBottom: '1rem' }}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <div className={styles.inputGroup}>
        <label htmlFor="newPassword">Kata Sandi Baru</label>
        <div className={styles.inputWrapper}>
          <span className={styles.inputIcon}>🔑</span>
          <input
            type={showPassword ? 'text' : 'password'}
            id="newPassword"
            name="newPassword"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimal 8 karakter (huruf & angka)"
            required
            disabled={loading}
          />
          <button
            type="button"
            className={styles.togglePassword}
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="confirmNewPassword">Konfirmasi Kata Sandi Baru</label>
        <div className={styles.inputWrapper}>
          <span className={styles.inputIcon}>🔒</span>
          <input
            type={showPassword ? 'text' : 'password'}
            id="confirmNewPassword"
            name="confirmNewPassword"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="Ketik ulang kata sandi baru"
            required
            disabled={loading}
          />
        </div>
      </div>

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={loading}
        id="btn-reset-password-submit"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
      >
        <span>{loading ? '⏳' : '💾'}</span>
        <span>{loading ? 'Menyimpan Sandi Baru...' : 'Simpan Kata Sandi Baru'}</span>
      </button>

      <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Batal atur ulang?{' '}
        <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
          Kembali ke Login
        </Link>
      </div>
    </form>
  )
}

