import { login } from '@/app/actions/auth'
import styles from './login.module.css'
import LoginFormClient from './LoginFormClient'
import ThemeToggle from '@/components/ThemeToggle'
import Link from 'next/link'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const error = params.error
  const isRegistered = params.registered === 'true'
  const isVerified = params.verified === 'true'
  const isResetSuccess = params.reset === 'success'

  const getErrorMessage = (err: string | string[] | undefined) => {
    if (err === 'TokenInvalid') return 'Tautan verifikasi tidak valid atau kedaluwarsa.'
    if (err === 'AccountInactive') return 'Akun Anda sedang dinonaktifkan. Silakan hubungi Administrator desa.'
    if (err === 'InvalidInput') return 'Data masukan login tidak lengkap atau tidak valid.'
    return 'Email atau kata sandi tidak valid. Silakan coba lagi.'
  }

  return (
    <div className={styles.container}>
      {/* Left Hero Panel */}
      <div className={styles.heroPanel}>
        <div className={styles.heroContent}>
          <div className={styles.heroIcon}>🏘️</div>
          <h1 className={styles.heroTitle}>Sistem Pelayanan Desa</h1>
          <p className={styles.heroSubtitle}>
            Platform administrasi desa terpadu berbasis kecerdasan buatan
            untuk pelayanan yang cepat, transparan, dan efisien.
          </p>
          <div className={styles.heroFeatures}>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.1rem' }}>📝</span>
              <span>Pengajuan surat online 24/7</span>
            </div>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.1rem' }}>🤖</span>
              <span>AI Assistant untuk panduan layanan</span>
            </div>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.1rem' }}>⚡</span>
              <span>Pantau status permohonan real-time</span>
            </div>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.1rem' }}>📊</span>
              <span>Dashboard analitik cerdas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className={styles.formPanel}>
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10 }}>
          <ThemeToggle variant="icon" />
        </div>
        <div className={styles.formContainer}>
          <div className={styles.titleArea}>
            <div className={styles.titleBadge}>
              <span>🔐</span>
              <span>Akses Aman</span>
            </div>
            <h2 className={styles.title}>Masuk ke Sistem</h2>
            <p className={styles.subtitle}>
              Silakan masuk untuk mengakses layanan desa
            </p>
          </div>

          {isRegistered && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.85rem 1rem',
              borderRadius: '0.5rem',
              background: '#dcfce7',
              border: '1px solid #86efac',
              color: '#15803d',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1.25rem'
            }}>
              <span style={{ fontSize: '1.2rem' }}>✅</span>
              <span>Akun warga berhasil dibuat! Silakan masuk dengan email dan kata sandi Anda.</span>
            </div>
          )}

          {isVerified && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.85rem 1rem',
              borderRadius: '0.5rem',
              background: '#dcfce7',
              border: '1px solid #86efac',
              color: '#15803d',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1.25rem'
            }}>
              <span style={{ fontSize: '1.2rem' }}>✅</span>
              <span>Alamat email Anda berhasil diverifikasi. Silakan masuk.</span>
            </div>
          )}

          {isResetSuccess && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.85rem 1rem',
              borderRadius: '0.5rem',
              background: '#dcfce7',
              border: '1px solid #86efac',
              color: '#15803d',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1.25rem'
            }}>
              <span style={{ fontSize: '1.2rem' }}>✅</span>
              <span>Kata sandi Anda berhasil diperbarui! Silakan masuk dengan kata sandi baru Anda.</span>
            </div>
          )}

          {error && (
            <div className={styles.errorAlert}>
              <span className={styles.errorIcon}>⚠️</span>
              <span>{getErrorMessage(error)}</span>
            </div>
          )}

          <LoginFormClient action={login} />

          <div className={styles.backLink}>
            <Link href="/">
              <span>🏠</span>
              <span>← Kembali ke Beranda</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
