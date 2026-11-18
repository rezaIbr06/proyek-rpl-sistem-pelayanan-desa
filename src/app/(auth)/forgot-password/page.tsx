import styles from '../login/login.module.css'
import ForgotPasswordFormClient from './ForgotPasswordFormClient'
import ThemeToggle from '@/components/ThemeToggle'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  return (
    <div className={styles.container}>
      {/* Left Hero Panel */}
      <div className={styles.heroPanel}>
        <div className={styles.heroContent}>
          <div className={styles.heroIcon}>🔐</div>
          <h1 className={styles.heroTitle}>Pemulihan Akun</h1>
          <p className={styles.heroSubtitle}>
            Sistem Pelayanan Desa menyediakan mekanisme pemulihan kata sandi yang aman dan berbatas waktu untuk menjaga kerahasiaan data warga.
          </p>
          <div className={styles.heroFeatures}>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.1rem' }}>🛡️</span>
              <span>Token acak kriptografis berbatas waktu (1 jam)</span>
            </div>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.1rem' }}>🔒</span>
              <span>Enkripsi hash SHA-256 tersimpan aman</span>
            </div>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.1rem' }}>📱</span>
              <span>Integrasi verifikasi multi-saluran resmi</span>
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
              <span>🔑</span>
              <span>Lupa Kata Sandi</span>
            </div>
            <h2 className={styles.title}>Atur Ulang Kata Sandi</h2>
            <p className={styles.subtitle}>
              Masukkan alamat email Anda untuk menerima instruksi pemulihan kata sandi akun
            </p>
          </div>

          <ForgotPasswordFormClient />

          <div className={styles.backLink}>
            <Link href="/login">
              <span>← Kembali ke Halaman Masuk</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

