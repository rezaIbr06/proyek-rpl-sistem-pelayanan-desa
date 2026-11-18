import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getDeliveryHistory } from '@/lib/notifications/notification-service'

export const metadata = {
  title: 'Pengaturan Notifikasi | Admin',
  description: 'Monitor status konfigurasi dan riwayat pengiriman notifikasi WhatsApp & Email',
}

/** Komponen status badge */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    SENT: '#16a34a',
    PENDING: '#d97706',
    PROCESSING: '#ea580c',
    FAILED: '#dc2626',
    ALREADY_SENT: '#6b7280',
  }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '99px',
      fontSize: '0.75rem',
      fontWeight: '600',
      color: '#fff',
      backgroundColor: colors[status] ?? '#6b7280',
    }}>
      {status}
    </span>
  )
}

/** Komponen channel badge */
function ChannelBadge({ channel }: { channel: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: '600',
      backgroundColor: channel === 'WHATSAPP' ? '#dcfce7' : '#fee2e2',
      color: channel === 'WHATSAPP' ? '#15803d' : '#991b1b',
    }}>
      {channel === 'WHATSAPP' ? '📱 WA' : '📧 Email'}
    </span>
  )
}

/** Komponen indikator konfigurasi */
function ConfigCard({
  title,
  icon,
  enabled,
  configured,
  detail,
}: {
  title: string
  icon: string
  enabled: boolean
  configured: boolean
  detail?: string | null
}) {
  const isReady = enabled && configured
  return (
    <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: `4px solid ${isReady ? '#16a34a' : '#dc2626'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>{title}</h3>
        <span style={{
          marginLeft: 'auto',
          padding: '2px 10px',
          borderRadius: '99px',
          fontSize: '0.75rem',
          fontWeight: '600',
          backgroundColor: isReady ? '#dcfce7' : '#fee2e2',
          color: isReady ? '#15803d' : '#dc2626',
        }}>
          {isReady ? '✓ Aktif & Siap' : (!configured ? '✗ Belum Dikonfigurasi' : '⏸ Dinonaktifkan')}
        </span>
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <span>Status saluran: <strong>{enabled ? 'Aktif' : 'Nonaktif'}</strong></span>
        <span>Kredensial: <strong>{configured ? 'Tersedia' : 'Belum diisi'}</strong></span>
        {detail && <span>Pengirim: <strong>{detail}</strong></span>}
        {!configured && (
          <p style={{ color: '#dc2626', margin: '0.5rem 0 0', fontSize: '0.8rem' }}>
            ⚠️ Integrasi belum siap. Isi environment variable yang sesuai.
          </p>
        )}
      </div>
    </div>
  )
}

export default async function NotifikasiAdminPage() {
  const session = await verifySession()
  if (session?.role !== 'ADMIN') redirect('/403')

  // Status konfigurasi (tanpa nilai rahasia)
  const isFonnte = !!process.env.FONNTE_TOKEN
  const isMeta = !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)

  const waConfig = {
    enabled: process.env.WHATSAPP_ENABLED === 'true',
    configured: isFonnte || isMeta,
    provider: isFonnte ? 'Fonnte Gateway' : (isMeta ? 'Meta WhatsApp Cloud API' : null),
  }
  const emailConfig = {
    enabled: process.env.GMAIL_ENABLED === 'true',
    configured: !!(process.env.GMAIL_SENDER_EMAIL && (
      (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN) ||
      process.env.GMAIL_APP_PASSWORD
    )),
    senderMasked: process.env.GMAIL_SENDER_EMAIL
      ? (() => {
          const [local, domain] = (process.env.GMAIL_SENDER_EMAIL ?? '').split('@')
          return `${local?.slice(0, 2) ?? '?'}***@${domain ?? '?'}`
        })()
      : null,
  }

  const deliveries = await getDeliveryHistory(100)

  const totalSent = deliveries.filter(d => d.status === 'SENT').length
  const totalFailed = deliveries.filter(d => d.status === 'FAILED').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#ffffff', fontWeight: 800 }}>🔔 Monitoring & Pengaturan Notifikasi</h1>
          <p style={{ color: '#ffffff', opacity: 0.95, margin: 0, fontWeight: 500 }}>
            Monitor status integrasi WhatsApp dan Gmail. Token dan kredensial tidak ditampilkan di sini.
          </p>
        </div>

        <Link
          href="/dashboard/admin/konfigurasi-wa"
          className="header-action-btn"
          style={{ textDecoration: 'none' }}
        >
          <span>📱</span>
          <span>Konfigurasi WhatsApp</span>
        </Link>
      </div>

      {/* Status Konfigurasi */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Status Integrasi</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <ConfigCard
          title="WhatsApp Gateway"
          icon="📱"
          enabled={waConfig.enabled}
          configured={waConfig.configured}
          detail={waConfig.provider}
        />
        <ConfigCard
          title="Gmail / Email"
          icon="📧"
          enabled={emailConfig.enabled}
          configured={emailConfig.configured}
          detail={emailConfig.senderMasked}
        />
      </div>

      {/* Ringkasan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#16a34a' }}>{totalSent}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Terkirim</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>{totalFailed}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gagal</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{deliveries.length}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total (100 terbaru)</div>
        </div>
      </div>

      {/* Riwayat Pengiriman */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Riwayat Pengiriman</h2>
      <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        {deliveries.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
            Belum ada riwayat pengiriman notifikasi eksternal.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)' }}>Channel</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)' }}>Event</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)' }}>Penerima</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)' }}>Percobaan</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)' }}>Waktu</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)' }}>Error</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <ChannelBadge channel={d.channel} />
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {d.eventType}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>
                    {d.recipientMasked}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <StatusBadge status={d.status} />
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                    {d.attemptCount}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                    {d.sentAt
                      ? new Date(d.sentAt).toLocaleString('id-ID')
                      : new Date(d.createdAt).toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', color: '#dc2626', fontSize: '0.8rem' }}>
                    {d.errorCode ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Petunjuk Konfigurasi */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '2rem', borderLeft: '4px solid var(--primary)' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>📋 Cara Mengaktifkan Notifikasi</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
          Edit file <code>.env</code> atau <code>.env.local</code> di root proyek dan isi variabel berikut:
        </p>
        <ul style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', paddingLeft: '1.5rem', lineHeight: '1.8' }}>
          <li><strong>WhatsApp:</strong> Atur <code>WHATSAPP_ENABLED=true</code>, <code>WHATSAPP_ACCESS_TOKEN</code>, dan <code>WHATSAPP_PHONE_NUMBER_ID</code></li>
          <li><strong>Email:</strong> Atur <code>GMAIL_ENABLED=true</code>, <code>GMAIL_SENDER_EMAIL</code>, dan pilih OAuth2 atau App Password</li>
        </ul>
        <p style={{ fontSize: '0.8rem', color: '#d97706', margin: '0.75rem 0 0' }}>
          ⚠️ Restart server setelah mengubah environment variable. Token tidak pernah ditampilkan di halaman ini.
        </p>
      </div>
    </div>
  )
}
