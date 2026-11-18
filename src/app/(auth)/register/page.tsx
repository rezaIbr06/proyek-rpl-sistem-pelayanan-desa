import type { Metadata } from 'next'
import styles from './register.module.css'
import RegisterFormClient from './RegisterFormClient'
import ThemeToggle from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: 'Buat Akun Warga | Sistem Pelayanan Desa',
  description: 'Daftar akun warga untuk pengajuan surat dan dokumen administrasi desa secara online.',
}

export default function RegisterPage() {
  return (
    <div className={styles.container}>
      {/* Left Hero Panel */}
      <div className={styles.heroPanel}>
        <div className={styles.heroContent}>
          <div className={styles.heroIcon}>🏘️</div>
          <h1 className={styles.heroTitle}>Pendaftaran Akun Warga</h1>
          <p className={styles.heroSubtitle}>
            Bergabunglah dengan platform pelayanan digital terpadu desa. 
            Ajukan surat pengantar dan administrasi desa langsung dari gawai Anda.
          </p>
          <div className={styles.heroFeatures}>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.2rem' }}>⚡</span>
              <span>Akses layanan administrasi desa 24 jam</span>
            </div>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.2rem' }}>📱</span>
              <span>Notifikasi status otomatis via WhatsApp & Email</span>
            </div>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.2rem' }}>🔒</span>
              <span>Keamanan data kependudukan terlindungi</span>
            </div>
            <div className={styles.heroFeatureItem}>
              <span style={{ fontSize: '1.2rem' }}>🤖</span>
              <span>Bimbingan AI untuk persyaratan dokumen</span>
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
              <span>📝</span>
              <span>Registrasi Mandiri</span>
            </div>
            <h2 className={styles.title}>Buat Akun Warga</h2>
            <p className={styles.subtitle}>
              Lengkapi formulir di bawah ini untuk membuat akun pelayanan desa.
            </p>
          </div>

          <RegisterFormClient />
        </div>
      </div>
    </div>
  )
}
