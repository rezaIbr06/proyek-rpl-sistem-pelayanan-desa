'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from '../login/login.module.css'
import { handleForgotPassword } from '@/app/actions/auth'

export default function ForgotPasswordFormClient() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [demoResetUrl, setDemoResetUrl] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    setDemoResetUrl(null)

    try {
      const formData = new FormData()
      formData.set('email', email)
      const res = await handleForgotPassword(formData)

      if (res.success) {
        setSuccessMessage(res.message)
        if (res.resetUrl) {
          setDemoResetUrl(res.resetUrl)
        }
      } else {
        setErrorMessage(res.error || 'Gagal mengirim instruksi pemulihan')
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Terjadi kesalahan pada jaringan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {successMessage && (
        <div style={{
          padding: '0.875rem 1rem',
          borderRadius: '0.5rem',
          backgroundColor: '#dcfce7',
          border: '1px solid #86efac',
          color: '#15803d',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '1rem',
          lineHeight: 1.5,
        }}>
          <div>✅ {successMessage}</div>
          {demoResetUrl && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #86efac', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 700, color: '#166534' }}>🛠️ Tautan Pemulihan Kata Sandi (Dev Mode):</span>
              <br />
              <Link
                href={demoResetUrl}
                style={{
                  display: 'inline-block',
                  marginTop: '0.35rem',
                  color: '#15803d',
                  textDecoration: 'underline',
                  wordBreak: 'break-all',
                  fontWeight: 700,
                }}
              >
                Klik di sini untuk langsung membuka form reset kata sandi
              </Link>
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className={styles.errorAlert} style={{ marginBottom: '1rem' }}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <div className={styles.inputGroup}>
        <label htmlFor="email">Alamat Email Terdaftar</label>
        <div className={styles.inputWrapper}>
          <span className={styles.inputIcon}>✉️</span>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            autoComplete="email"
            required
            disabled={loading}
          />
        </div>
      </div>

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={loading}
        id="btn-forgot-password-submit"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
      >
        <span>{loading ? '⏳' : '📨'}</span>
        <span>{loading ? 'Mengirim Instruksi...' : 'Kirim Tautan Pemulihan'}</span>
      </button>

      <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Sudah mengingat kata sandi?{' '}
        <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
          Kembali ke Login
        </Link>
      </div>
    </form>
  )
}

