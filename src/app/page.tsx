import styles from './page.module.css';
import AiAssistant from '@/components/AiAssistant';
import ThemeToggle from '@/components/ThemeToggle';

export default function Home() {
  return (
    <main className={styles.main}>
      <header className={styles.topNav}>
        <ThemeToggle variant="segmented" />
      </header>

      <div className={`glass-panel ${styles.hero}`}>
        <h1 className={styles.title}>Sistem Pelayanan Desa</h1>
        <p className={styles.description}>
          Layanan administrasi desa yang cepat, transparan, dan terpadu.
          Tanya AI Assistant kami untuk panduan layanan.
        </p>
        
        <div className={styles.actions}>
          <a href="/login" className={`${styles.btn} ${styles.btnPrimary}`}>
            Masuk ke Sistem
          </a>
          <a href="/register" className={`${styles.btn} ${styles.btnSecondary}`}>
            Buat Akun Warga
          </a>
        </div>
      </div>
      
      <section id="layanan" className={styles.features}>
        <div className={styles.featureCard}>
          <h3>📝 Pengajuan Online</h3>
          <p>Ajukan surat keterangan dan permohonan administrasi dari rumah tanpa antre.</p>
        </div>
        <div className={styles.featureCard}>
          <h3>🤖 AI Assistant</h3>
          <p>Dapatkan jawaban cepat seputar persyaratan dan prosedur layanan dari asisten pintar kami.</p>
        </div>
        <div className={styles.featureCard}>
          <h3>⚡ Pantau Status</h3>
          <p>Lacak status permohonan Anda secara real-time langsung dari dashboard.</p>
        </div>
      </section>

      <AiAssistant />
    </main>
  );
}
