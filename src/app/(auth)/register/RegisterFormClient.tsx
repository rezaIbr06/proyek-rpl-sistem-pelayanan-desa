'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './register.module.css'

export default function RegisterFormClient() {
  const router = useRouter()

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    nomorTelepon: '',
    alamat: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
    // Clear previous error on type
    if (error) setError(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validasi Frontend Cepat
    if (!formData.name.trim()) {
      setError('Nama lengkap wajib diisi.')
      return
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Format email tidak valid.')
      return
    }
    const cleanPhone = formData.nomorTelepon.replace(/\D/g, '')
    if (cleanPhone.length < 9 || cleanPhone.length > 15) {
      setError('Nomor telepon harus nomor Indonesia yang valid (9–15 digit, contoh: 08123456789).')
      return
    }
    if (!formData.alamat.trim() || formData.alamat.trim().length < 5) {
      setError('Alamat tempat tinggal minimal 5 karakter.')
      return
    }
    if (formData.password.length < 8) {
      setError('Kata sandi minimal 8 karakter.')
      return
    }
    if (!/[A-Za-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      setError('Kata sandi harus mengandung kombinasi huruf dan angka.')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok dengan kata sandi yang dimasukkan.')
      return
    }
    if (!formData.agreeTerms) {
      setError('Anda harus menyetujui ketentuan layanan dan kebijakan privasi penggunaan data.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          nomorTelepon: formData.nomorTelepon.trim(),
          alamat: formData.alamat.trim(),
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          agreeTerms: formData.agreeTerms,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Pendaftaran gagal. Silakan periksa kembali data Anda.')
        setLoading(false)
        return
      }

      setSuccess('✓ Akun warga Anda berhasil dibuat! Mengalihkan ke halaman login...')
      // Berikan jeda 1.5 detik agar pengguna melihat pesan sukses
      setTimeout(() => {
        router.push('/login?registered=true')
      }, 1500)
    } catch {
      setError('Terjadi kendala koneksi ke server. Silakan periksa internet Anda dan coba lagi.')
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div className={styles.errorAlert} role="alert" id="register-error">
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className={styles.successAlert} role="status" id="register-success">
          <span style={{ fontSize: '1.2rem' }}>✅</span>
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.formGrid}>
          {/* 1. Nama Lengkap */}
          <div className={styles.inputGroupFull}>
            <label htmlFor="name">Nama Lengkap Sesuai KTP *</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>👤</span>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Contoh: Budi Santoso"
                autoComplete="name"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* 2. Email Aktif */}
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email Aktif *</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>✉️</span>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="nama@email.com"
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* 3. Nomor Telepon / WhatsApp */}
          <div className={styles.inputGroup}>
            <label htmlFor="nomorTelepon">No. WhatsApp / HP *</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>📱</span>
              <input
                type="tel"
                id="nomorTelepon"
                name="nomorTelepon"
                value={formData.nomorTelepon}
                onChange={handleChange}
                placeholder="081234567890"
                autoComplete="tel"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* 4. Alamat Tempat Tinggal */}
          <div className={styles.inputGroupFull}>
            <label htmlFor="alamat">Alamat Tempat Tinggal *</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon} style={{ top: '0.75rem' }}>🏠</span>
              <textarea
                id="alamat"
                name="alamat"
                value={formData.alamat}
                onChange={handleChange}
                placeholder="Nama jalan, RT/RW, Dusun di wilayah Desa"
                rows={2}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* 5. Password */}
          <div className={styles.inputGroup}>
            <label htmlFor="password">Kata Sandi (Min. 8 Karakter) *</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>🔑</span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete="new-password"
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

          {/* 6. Konfirmasi Password */}
          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword">Ulangi Kata Sandi *</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>🔒</span>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                disabled={loading}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
        </div>

        {/* 7. Checkbox Persetujuan Penggunaan Data */}
        <div className={styles.checkboxGroup}>
          <input
            type="checkbox"
            id="agreeTerms"
            name="agreeTerms"
            checked={formData.agreeTerms}
            onChange={handleChange}
            className={styles.checkbox}
            required
            disabled={loading}
          />
          <label htmlFor="agreeTerms" className={styles.checkboxLabel}>
            Saya menyetujui <strong>Ketentuan Layanan</strong> dan memberikan persetujuan penggunaan data kependudukan untuk keperluan administrasi desa secara aman.
          </label>
        </div>

        {/* Tombol Buat Akun */}
        <button
          type="submit"
          className={styles.submitBtn}
          id="register-submit"
          disabled={loading}
        >
          {loading ? (
            <>
              <span>⏳</span>
              <span>Memproses Pembuatan Akun...</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>Buat Akun Warga</span>
            </>
          )}
        </button>
      </form>

      {/* Footer Navigation Links */}
      <div className={styles.footerLinks}>
        <div className={styles.loginPrompt}>
          Sudah memiliki akun warga atau staf?
          <Link href="/login" className={styles.loginLink} id="link-to-login">
            Masuk ke Sistem
          </Link>
        </div>

        <Link href="/" className={styles.backHomeLink}>
          <span>← Kembali ke Halaman Utama Desa</span>
        </Link>
      </div>
    </>
  )
}
