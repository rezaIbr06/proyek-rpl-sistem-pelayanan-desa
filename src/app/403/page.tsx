import Link from 'next/link'
import styles from './403.module.css'

export default function ForbiddenPage() {
  return (
    <div className={styles.container}>
      <div className={`glass-panel ${styles.content}`}>
        <h1 className={styles.errorCode}>403</h1>
        <h2 className={styles.title}>Akses Ditolak</h2>
        <p className={styles.description}>
          Maaf, Anda tidak memiliki izin untuk mengakses halaman ini.
          Pastikan Anda masuk dengan akun yang memiliki hak akses yang sesuai.
        </p>
        <div className={styles.actions}>
          <Link href="/dashboard" className={styles.btnPrimary}>
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
