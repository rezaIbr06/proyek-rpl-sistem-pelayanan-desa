import styles from '../login/login.module.css'
import ResetPasswordFormClient from './ResetPasswordFormClient'
import ThemeToggle from '@/components/ThemeToggle'
import Link from 'next/link'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : ''

  return (
    <div className={styles.container}>
      {/* Left Hero Panel */}
      <div className={styles.heroPanel}>
        <div className={styles.heroContent}>
          <div className={styles.heroIcon}>🛡️</div>
          <h1 className={styles.heroTitle}>Sistem Pelayanan Desa</h1>
          <p className={styles.heroSubtitle}>
            Pembaruan kata sandi akun dengan enkripsi standar industri untuk menjamin keamanan akses data kependudukan Anda.
          </p>
          <div className={styles.heroFeatures}>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.1rem' }}>🔐</span>
              <span>Proteksi sandi menggunakan bcrypt hash</span>
            </div>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.1rem' }}>🚪</span>
              <span>Otomatis menutup sesi lama di perangkat lain</span>
            </div>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.1rem' }}>📋</span>
              <span>Audit log tercatat secara transparan</span>
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
              <span>✨</span>
              <span>Sandi Baru</span>
            </div>
            <h2 className={styles.title}>Buat Kata Sandi Baru</h2>
            <p className={styles.subtitle}>
              Silakan tentukan kata sandi baru yang kuat untuk akun desa Anda
            </p>
          </div>

          <ResetPasswordFormClient token={token} />

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

