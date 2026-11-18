'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from './login.module.css'

export default function LoginFormClient({
  action,
}: {
  action: (formData: FormData) => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <form action={action} className={styles.form}>
      <div className={styles.inputGroup}>
        <label htmlFor="email">Email</label>
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
          />
        </div>
      </div>

      <div className={styles.inputGroup}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <label htmlFor="password" style={{ marginBottom: 0 }}>Kata Sandi</label>
          <Link href="/forgot-password" id="link-forgot-password" style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
            Lupa kata sandi?
          </Link>
        </div>
        <div className={styles.inputWrapper}>
          <span className={styles.inputIcon}>🔑</span>
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
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

      <button type="submit" className={styles.submitBtn} id="login-submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <span>🚀</span>
        <span>Masuk ke Sistem</span>
      </button>

      <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Belum memiliki akun warga?{' '}
        <Link href="/register" id="link-to-register" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
          Buat Akun Warga
        </Link>
      </div>
    </form>
  )
}
