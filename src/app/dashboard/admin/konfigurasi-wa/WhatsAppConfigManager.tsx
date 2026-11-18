'use client';

import React, { useState, useTransition, useEffect, useCallback } from 'react';
import {
  WhatsAppAdminViewData,
  WhatsAppConnectionTestResult,
  WhatsAppLogDTO,
  WhatsAppSendResult,
  WhatsAppSettingDTO
} from '@/lib/whatsapp/types';
import {
  saveWhatsAppConfigAction,
  testWhatsAppConnectionAction,
  sendWhatsAppTestMessageAction,
  toggleWhatsAppEnabledAction,
  updateWhatsAppNotificationSettingAction,
  getWhatsAppLogsAction
} from '@/app/actions/whatsapp-config';
import styles from './whatsappConfig.module.css';

interface Props {
  initialData: WhatsAppAdminViewData;
}

export default function WhatsAppConfigManager({ initialData }: Props) {
  const [activeTab, setActiveTab] = useState<'provider' | 'settings' | 'templates' | 'logs'>('provider');
  const [isPending, startTransition] = useTransition();

  // Provider Form States
  const [provider, setProvider] = useState<'FONNTE' | 'WHATSAPP_CLOUD_API'>(
    initialData.config.provider === 'FONNTE' ? 'FONNTE' : 'WHATSAPP_CLOUD_API'
  );
  const [phoneNumberId, setPhoneNumberId] = useState(initialData.config.phoneNumberId || '');
  const [businessAccountId, setBusinessAccountId] = useState(initialData.config.businessAccountId || '');
  const [apiVersion, setApiVersion] = useState(initialData.config.apiVersion || 'v19.0');
  const [senderPhone, setSenderPhone] = useState(initialData.config.senderPhone || '');
  const [isEnabled, setIsEnabled] = useState(initialData.config.isEnabled);

  // Fonnte credentials
  const [newFonnteToken, setNewFonnteToken] = useState('');
  const [showFonnteToken, setShowFonnteToken] = useState(false);

  // Meta credential inputs (left blank to keep saved ones)
  const [newAccessToken, setNewAccessToken] = useState('');
  const [showAccessToken, setShowAccessToken] = useState(false);

  const [newAppSecret, setNewAppSecret] = useState('');
  const [showAppSecret, setShowAppSecret] = useState(false);

  const [newWebhookVerifyToken, setNewWebhookVerifyToken] = useState('');
  const [showWebhookVerifyToken, setShowWebhookVerifyToken] = useState(false);

  // Credential metadata
  const [credsMeta, setCredsMeta] = useState(initialData.credentials);
  const [connectionStatus, setConnectionStatus] = useState(initialData.config.connectionStatus);

  // Notifications & Test Results
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testResult, setTestResult] = useState<WhatsAppConnectionTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Test Message Modal
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSendResult, setTestSendResult] = useState<WhatsAppSendResult | null>(null);

  // Settings State
  const [settings, setSettings] = useState<WhatsAppSettingDTO[]>(initialData.settings);

  // Logs State
  const [logs, setLogs] = useState<WhatsAppLogDTO[]>([]);
  const [logsFilterStatus, setLogsFilterStatus] = useState('ALL');
  const [logsSearchAppId, setLogsSearchAppId] = useState('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    const res = await getWhatsAppLogsAction({
      status: logsFilterStatus,
      applicationId: logsSearchAppId || undefined,
      limit: 50
    });
    if (res.success) {
      setLogs(res.logs);
    }
    setIsLoadingLogs(false);
  }, [logsFilterStatus, logsSearchAppId]);

  // Load logs on tab switch
  useEffect(() => {
    if (activeTab === 'logs') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  // Handler: Save Provider Configuration
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    startTransition(async () => {
      const res = await saveWhatsAppConfigAction({
        provider,
        phoneNumberId: phoneNumberId.trim() || undefined,
        businessAccountId: businessAccountId.trim() || undefined,
        apiVersion: apiVersion.trim() || undefined,
        senderPhone: senderPhone.trim() || undefined,
        isEnabled,
        newAccessToken: newAccessToken.trim() || undefined,
        newAppSecret: newAppSecret.trim() || undefined,
        newWebhookVerifyToken: newWebhookVerifyToken.trim() || undefined,
        newFonnteToken: newFonnteToken.trim() || undefined
      });

      if (res.success) {
        setNotification({ type: 'success', message: res.message });
        if (newFonnteToken.trim()) {
          setCredsMeta(prev => ({
            ...prev,
            hasFonnteToken: true,
            fonnteTokenMask: `${newFonnteToken.slice(0, 4)}••••••••••••${newFonnteToken.slice(-4)}`
          }));
          setNewFonnteToken('');
        }
        if (newAccessToken.trim()) {
          setCredsMeta(prev => ({
            ...prev,
            hasAccessToken: true,
            accessTokenMask: `${newAccessToken.slice(0, 4)}••••••••••••${newAccessToken.slice(-4)}`
          }));
          setNewAccessToken('');
        }
        if (newAppSecret.trim()) {
          setCredsMeta(prev => ({
            ...prev,
            hasAppSecret: true,
            appSecretMask: `${newAppSecret.slice(0, 4)}••••••••••••${newAppSecret.slice(-4)}`
          }));
          setNewAppSecret('');
        }
        if (newWebhookVerifyToken.trim()) {
          setCredsMeta(prev => ({
            ...prev,
            hasWebhookVerifyToken: true,
            webhookVerifyTokenMask: `${newWebhookVerifyToken.slice(0, 4)}••••••••••••${newWebhookVerifyToken.slice(-4)}`
          }));
          setNewWebhookVerifyToken('');
        }
      } else {
        setNotification({ type: 'error', message: res.error || res.message });
      }
    });
  };

  // Handler: Test Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setNotification(null);

    try {
      const res = await testWhatsAppConnectionAction({
        provider,
        phoneNumberId: phoneNumberId.trim() || undefined,
        accessToken: newAccessToken.trim() || undefined,
        apiVersion: apiVersion.trim() || undefined,
        fonnteToken: newFonnteToken.trim() || undefined
      });

      setTestResult(res);
      if (res.success) {
        setConnectionStatus('CONNECTED');
      } else {
        setConnectionStatus('FAILED');
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Uji koneksi gagal.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Handler: Send Test Message
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) return;

    setIsSendingTest(true);
    setTestSendResult(null);

    try {
      const res = await sendWhatsAppTestMessageAction(testPhone.trim());
      setTestSendResult(res);
      if (res.success) {
        setNotification({
          type: 'success',
          message: `Pesan uji coba berhasil dikirim ke nomor ${res.recipientPhone}! ID Pesan: ${res.providerMessageId}`
        });
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  // Handler: Toggle WhatsApp Enabled
  const handleToggleGlobalEnabled = async (checked: boolean) => {
    setIsEnabled(checked);
    const res = await toggleWhatsAppEnabledAction(checked);
    if (res.success) {
      setNotification({ type: 'success', message: res.message });
    }
  };

  // Handler: Toggle Notification Setting
  const handleToggleSetting = async (settingId: string, currentVal: boolean) => {
    const newVal = !currentVal;
    // Optimistic update
    setSettings(prev =>
      prev.map(s => (s.id === settingId ? { ...s, isEnabled: newVal } : s))
    );

    const res = await updateWhatsAppNotificationSettingAction(settingId, newVal);
    if (!res.success) {
      // Revert if failed
      setSettings(prev =>
        prev.map(s => (s.id === settingId ? { ...s, isEnabled: currentVal } : s))
      );
      setNotification({ type: 'error', message: res.message });
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>
            <span>📱</span>
            <span>Konfigurasi WhatsApp Gateway</span>
          </h1>
          <p className={styles.pageSubtitle}>
            Kelola integrasi WhatsApp (Fonnte Gateway atau Meta WhatsApp Cloud API) untuk otomatisasi tanda terima permohonan dan notifikasi warga.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || isPending}
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            {isTesting ? (
              <>
                <span>⏳</span>
                <span>Menguji...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Uji Koneksi {provider === 'FONNTE' ? 'Fonnte' : 'Meta'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowTestModal(true);
              setTestSendResult(null);
            }}
            className={`${styles.btn} ${styles.btnSuccess}`}
          >
            <span>💬</span>
            <span>Kirim Pesan Percobaan</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {notification && (
        <div className={`${styles.alertBox} ${notification.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
          <span>{notification.type === 'success' ? '✅' : '⚠️'}</span>
          <div style={{ flex: 1 }}>{notification.message}</div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Connection Test Result Box */}
      {testResult && (
        <div className={`${styles.alertBox} ${testResult.success ? styles.alertSuccess : styles.alertError}`}>
          <span style={{ fontSize: '1.25rem' }}>{testResult.success ? '🎉' : '❌'}</span>
          <div style={{ flex: 1 }}>
            <strong>
              {testResult.success
                ? `Koneksi ${testResult.provider === 'FONNTE' ? 'Fonnte' : 'Meta'} Berhasil`
                : `Koneksi ${testResult.provider === 'FONNTE' ? 'Fonnte' : 'Meta'} Gagal`}:
            </strong>
            <div style={{ marginTop: '0.25rem' }}>{testResult.message}</div>
            {testResult.latencyMs !== undefined && (
              <div style={{ marginTop: '0.2rem', fontSize: '0.8rem', opacity: 0.9 }}>
                Latensi API: <strong>{testResult.latencyMs} ms</strong>
                {testResult.quota !== undefined && ` | Sisa Kuota: ${testResult.quota}`}
                {testResult.qualityRating && ` | Quality Rating: ${testResult.qualityRating}`}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTestResult(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Status Overview Card */}
      <div className={styles.statusCard}>
        <div className={styles.statusIndicator}>
          <div
            className={`${styles.statusDot} ${
              !isEnabled
                ? styles.statusDotInactive
                : connectionStatus === 'CONNECTED'
                ? styles.statusDotActive
                : connectionStatus === 'FAILED'
                ? styles.statusDotInactive
                : styles.statusDotWarn
            }`}
          />
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Status WhatsApp Gateway: {isEnabled ? 'Aktif' : 'Dinonaktifkan'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Provider Aktif:{' '}
              <strong style={{ color: provider === 'FONNTE' ? '#10b981' : '#2563eb' }}>
                {provider === 'FONNTE' ? 'Fonnte WhatsApp Gateway' : 'WhatsApp Business Cloud API (Meta)'}
              </strong>{' '}
              &bull; Status Koneksi:{' '}
              <span style={{ fontWeight: 600, color: connectionStatus === 'CONNECTED' ? '#10b981' : '#ea580c' }}>
                {connectionStatus === 'CONNECTED' ? 'Terhubung' : connectionStatus === 'FAILED' ? 'Gagal Terhubung' : 'Belum Diuji'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={isEnabled}
              onChange={e => handleToggleGlobalEnabled(e.target.checked)}
            />
            <div className={`${styles.toggleTrack} ${isEnabled ? styles.toggleTrackActive : ''}`}>
              <div className={`${styles.toggleThumb} ${isEnabled ? styles.toggleThumbActive : ''}`} />
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {isEnabled ? 'Saluran Dibuka' : 'Saluran Ditutup'}
            </span>
          </label>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabsBar}>
        <button
          type="button"
          onClick={() => setActiveTab('provider')}
          className={`${styles.tabBtn} ${activeTab === 'provider' ? styles.tabBtnActive : ''}`}
        >
          <span>🏢</span>
          <span>1. Pengaturan Provider</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.tabBtnActive : ''}`}
        >
          <span>🔔</span>
          <span>2. Pengaturan Notifikasi ({settings.filter(s => s.isEnabled).length}/{settings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`${styles.tabBtn} ${activeTab === 'templates' ? styles.tabBtnActive : ''}`}
        >
          <span>📋</span>
          <span>3. Template Pesan ({initialData.templates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`${styles.tabBtn} ${activeTab === 'logs' ? styles.tabBtnActive : ''}`}
        >
          <span>📊</span>
          <span>4. Riwayat Pengiriman</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: PENGATURAN PROVIDER */}
      {/* ============================================================ */}
      {activeTab === 'provider' && (
        <form onSubmit={handleSaveConfig} className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>
                <span>🏢</span>
                <span>
                  {provider === 'FONNTE'
                    ? 'Pengaturan Provider Fonnte WhatsApp Gateway'
                    : 'Pengaturan Provider Meta WhatsApp Cloud API'}
                </span>
              </h2>
              <div className={styles.sectionDescription}>
                {provider === 'FONNTE'
                  ? 'Gunakan Fonnte untuk kemudahan integrasi WhatsApp gateway tanpa memerlukan akun developer atau verifikasi bisnis Meta.'
                  : 'Masukkan kredensial resmi dari Meta for Developers Dashboard. Kredensial dienkripsi aman dengan AES-256-GCM.'}
              </div>
            </div>

            <span
              className={`${styles.badge} ${
                (provider === 'FONNTE' ? credsMeta.hasFonnteToken : credsMeta.hasAccessToken)
                  ? styles.badgeSuccess
                  : styles.badgeWarning
              }`}
            >
              {provider === 'FONNTE'
                ? credsMeta.hasFonnteToken
                  ? 'Token Fonnte Tersimpan'
                  : 'Token Fonnte Belum Diisi'
                : credsMeta.hasAccessToken
                ? 'Token Meta Tersimpan'
                : 'Token Meta Belum Lengkap'}
            </span>
          </div>

          <div className={styles.sectionBody}>
            {/* Provider Switcher Selector */}
            <div className={styles.formGroup} style={{ marginBottom: '1.5rem' }}>
              <label className={styles.formLabel}>Pilih Provider WhatsApp Aktif</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1rem',
                  marginTop: '0.5rem'
                }}
              >
                <div
                  onClick={() => setProvider('FONNTE')}
                  style={{
                    border: provider === 'FONNTE' ? '2px solid #10b981' : '1px solid var(--border)',
                    backgroundColor: provider === 'FONNTE' ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-alt)',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      🟢 Fonnte WhatsApp Gateway
                    </div>
                    {provider === 'FONNTE' && <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>✓ Aktif</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Direkomendasikan: Hubungkan nomor WhatsApp desa dengan scan QR code di Fonnte. Tanpa perlu verifikasi Facebook Meta.
                  </div>
                </div>

                <div
                  onClick={() => setProvider('WHATSAPP_CLOUD_API')}
                  style={{
                    border: provider === 'WHATSAPP_CLOUD_API' ? '2px solid #2563eb' : '1px solid var(--border)',
                    backgroundColor: provider === 'WHATSAPP_CLOUD_API' ? 'rgba(37, 99, 235, 0.08)' : 'var(--surface-alt)',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      🔵 Meta WhatsApp Cloud API
                    </div>
                    {provider === 'WHATSAPP_CLOUD_API' && <span style={{ color: '#2563eb', fontWeight: 700, fontSize: '0.85rem' }}>✓ Aktif</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Layanan resmi Meta Graph API untuk pengiriman pesan skala besar menggunakan template pesan disetujui Meta.
                  </div>
                </div>
              </div>
            </div>

            {/* ==================== PROVIDER: FONNTE ==================== */}
            {provider === 'FONNTE' && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    <span>Fonnte API Token (Device Secret Token)</span>
                    {credsMeta.fonnteTokenMask && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                        Tersimpan: <code style={{ color: 'var(--primary)' }}>{credsMeta.fonnteTokenMask}</code>
                      </span>
                    )}
                  </label>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type={showFonnteToken ? 'text' : 'password'}
                      className={styles.input}
                      value={newFonnteToken}
                      onChange={e => setNewFonnteToken(e.target.value)}
                      placeholder={
                        credsMeta.hasFonnteToken
                          ? 'Biarkan kosong untuk mempertahankan token tersimpan'
                          : 'Masukkan API Token dari Fonnte (contoh: zvTvFK2gEQKm...)'
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowFonnteToken(!showFonnteToken)}
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      style={{ padding: '0.5rem 0.85rem' }}
                    >
                      {showFonnteToken ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <span className={styles.fieldDescription}>
                    Diperoleh dari dashboard Fonnte (<em>https://fonnte.com &gt; Menu Device &gt; Salin Token</em>). Token disimpan terenkripsi AES-256-GCM.
                  </span>
                </div>

                {/* Panduan Integrasi Fonnte */}
                <div
                  className={styles.alertBox}
                  style={{
                    backgroundColor: 'var(--surface-alt)',
                    border: '1px solid var(--border)',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>💡</span>
                    <strong style={{ color: 'var(--text-primary)' }}>Panduan Cepat Menghubungkan WhatsApp via Fonnte:</strong>
                  </div>
                  <ol style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <li>
                      Buka situs resmi <strong><a href="https://fonnte.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>https://fonnte.com</a></strong> dan daftarkan akun jika belum memiliki akun.
                    </li>
                    <li>
                      Masuk ke menu <strong>Device</strong> &gt; klik <strong>Tambah Device</strong>.
                    </li>
                    <li>
                      Klik <strong>Scan QR</strong> lalu gunakan aplikasi WhatsApp di HP desa / petugas untuk memindai QR Code tersebut hingga status device menjadi <strong>Connect</strong>.
                    </li>
                    <li>
                      Salin <strong>API Token</strong> device tersebut, tempelkan pada kolom di atas, lalu klik tombol <strong>Simpan Konfigurasi WhatsApp</strong>.
                    </li>
                    <li>
                      Klik tombol <strong>Uji Koneksi Fonnte</strong> untuk memastikan server berhasil terhubung ke device dan melihat sisa kuota pesan.
                    </li>
                  </ol>
                </div>
              </>
            )}

            {/* ==================== PROVIDER: META CLOUD API ==================== */}
            {provider === 'WHATSAPP_CLOUD_API' && (
              <>
                {/* Phone Number ID & WABA ID */}
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Phone Number ID Meta</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={phoneNumberId}
                      onChange={e => setPhoneNumberId(e.target.value)}
                      placeholder="Contoh: 109876543210987"
                    />
                    <span className={styles.fieldDescription}>
                      Diperoleh dari <em>Meta for Developers &gt; WhatsApp &gt; API Setup &gt; Phone Number ID</em>.
                    </span>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>WhatsApp Business Account ID (WABA ID)</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={businessAccountId}
                      onChange={e => setBusinessAccountId(e.target.value)}
                      placeholder="Contoh: 987654321098765"
                    />
                    <span className={styles.fieldDescription}>
                      ID akun bisnis WhatsApp Anda di Meta Business Manager.
                    </span>
                  </div>
                </div>

                {/* API Version & Sender Phone */}
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Versi Meta Graph API</label>
                    <select
                      className={styles.select}
                      value={apiVersion}
                      onChange={e => setApiVersion(e.target.value)}
                    >
                      <option value="v19.0">v19.0 (Rekomendasi)</option>
                      <option value="v20.0">v20.0</option>
                      <option value="v21.0">v21.0</option>
                    </select>
                    <span className={styles.fieldDescription}>
                      Versi endpoint resmi Graph API Meta.
                    </span>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nomor WhatsApp Pengirim (Display Phone)</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={senderPhone}
                      onChange={e => setSenderPhone(e.target.value)}
                      placeholder="Contoh: +62 812-3456-7890"
                    />
                    <span className={styles.fieldDescription}>
                      Nomor telepon bisnis yang terdaftar dan diverifikasi di WhatsApp Manager.
                    </span>
                  </div>
                </div>

                {/* Access Token (Encrypted) */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    <span>System User Access Token (Permanent Token)</span>
                    {credsMeta.accessTokenMask && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                        Tersimpan: <code style={{ color: 'var(--primary)' }}>{credsMeta.accessTokenMask}</code>
                      </span>
                    )}
                  </label>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type={showAccessToken ? 'text' : 'password'}
                      className={styles.input}
                      value={newAccessToken}
                      onChange={e => setNewAccessToken(e.target.value)}
                      placeholder={
                        credsMeta.hasAccessToken
                          ? 'Biarkan kosong untuk mempertahankan token tersimpan'
                          : 'Masukkan Meta System User Token (dimulai dengan EAAB...)'
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccessToken(!showAccessToken)}
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      style={{ padding: '0.5rem 0.85rem' }}
                    >
                      {showAccessToken ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <span className={styles.fieldDescription}>
                    Gunakan Permanent Token dari <em>Meta Business Manager &gt; System Users &gt; Generate Token</em> dengan permission <code>whatsapp_business_messaging</code>.
                  </span>
                </div>

                {/* App Secret & Webhook Verify Token */}
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      <span>Meta App Secret (Validasi Signature Webhook)</span>
                      {credsMeta.appSecretMask && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                          Tersimpan: <code style={{ color: 'var(--primary)' }}>{credsMeta.appSecretMask}</code>
                        </span>
                      )}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type={showAppSecret ? 'text' : 'password'}
                        className={styles.input}
                        value={newAppSecret}
                        onChange={e => setNewAppSecret(e.target.value)}
                        placeholder={
                          credsMeta.hasAppSecret
                            ? 'Biarkan kosong untuk mempertahankan secret'
                            : 'Dari Meta App Dashboard > Settings > Basic'
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowAppSecret(!showAppSecret)}
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        style={{ padding: '0.5rem 0.85rem' }}
                      >
                        {showAppSecret ? '🙈' : '👁️'}
                      </button>
                    </div>
                    <span className={styles.fieldDescription}>
                      Digunakan server untuk memverifikasi header <code>X-Hub-Signature-256</code> pada setiap webhook yang masuk.
                    </span>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      <span>Webhook Verify Token</span>
                      {credsMeta.webhookVerifyTokenMask && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                          Tersimpan: <code style={{ color: 'var(--primary)' }}>{credsMeta.webhookVerifyTokenMask}</code>
                        </span>
                      )}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type={showWebhookVerifyToken ? 'text' : 'password'}
                        className={styles.input}
                        value={newWebhookVerifyToken}
                        onChange={e => setNewWebhookVerifyToken(e.target.value)}
                        placeholder={
                          credsMeta.hasWebhookVerifyToken
                            ? 'Biarkan kosong untuk mempertahankan verify token'
                            : 'Token acak pilihan Anda untuk verifikasi challenge'
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebhookVerifyToken(!showWebhookVerifyToken)}
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        style={{ padding: '0.5rem 0.85rem' }}
                      >
                        {showWebhookVerifyToken ? '🙈' : '👁️'}
                      </button>
                    </div>
                    <span className={styles.fieldDescription}>
                      Masukkan token ini di Meta App Dashboard pada saat mengonfigurasi Webhook URL.
                    </span>
                  </div>
                </div>

                {/* Webhook Endpoint Info Box */}
                <div className={styles.alertBox} style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '1.25rem' }}>🔗</span>
                  <div style={{ flex: 1, fontSize: '0.85rem' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>URL Callback Webhook Meta:</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                      <code style={{ padding: '0.3rem 0.6rem', backgroundColor: 'var(--input-bg)', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.85rem', flex: 1 }}>
                        {initialData.webhookUrl}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(initialData.webhookUrl);
                          alert('Webhook URL disalin ke clipboard!');
                        }}
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Salin URL
                      </button>
                    </div>
                    <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)' }}>
                      Di Meta Developer Portal, daftarkan URL di atas dan centang subscription field: <strong>messages</strong>.
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className={styles.footerActions}>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || isPending}
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              <span>🧪</span>
              <span>Uji Koneksi {provider === 'FONNTE' ? 'Fonnte' : 'Meta'}</span>
            </button>

            <button
              type="submit"
              disabled={isPending || isTesting}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              {isPending ? 'Menyimpan...' : 'Simpan Konfigurasi WhatsApp'}
            </button>
          </div>
        </form>
      )}

      {/* ============================================================ */}
      {/* TAB 2: PENGATURAN NOTIFIKASI (EVENT TOGGLES) */}
      {/* ============================================================ */}
      {activeTab === 'settings' && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>
                <span>🔔</span>
                <span>Pengaturan Jenis Notifikasi Otomatis</span>
              </h2>
              <div className={styles.sectionDescription}>
                Pilih peristiwa mana saja yang akan memicu pengiriman pesan WhatsApp secara otomatis kepada Warga atau Staf.
              </div>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th style={{ width: '45px' }}>Status</th>
                  <th>Nama Peristiwa (Event)</th>
                  <th>Deskripsi & Tujuan</th>
                  <th>Penerima</th>
                  <th>Template Pesan</th>
                </tr>
              </thead>
              <tbody>
                {settings.map(st => (
                  <tr key={st.id}>
                    <td>
                      <label className={styles.toggleSwitch}>
                        <input
                          type="checkbox"
                          className={styles.toggleInput}
                          checked={st.isEnabled}
                          onChange={() => handleToggleSetting(st.id, st.isEnabled)}
                        />
                        <div className={`${styles.toggleTrack} ${st.isEnabled ? styles.toggleTrackActive : ''}`}>
                          <div className={`${styles.toggleThumb} ${st.isEnabled ? styles.toggleThumbActive : ''}`} />
                        </div>
                      </label>
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{st.name}</div>
                      <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{st.eventType}</code>
                    </td>

                    <td style={{ color: 'var(--text-secondary)', maxWidth: '350px' }}>
                      {st.description}
                    </td>

                    <td>
                      <span className={`${styles.badge} ${st.recipientType === 'STAFF' ? styles.badgeWarning : styles.badgeInfo}`}>
                        {st.recipientType === 'STAFF' ? '👷 Petugas / Staf' : '👤 Warga Pemohon'}
                      </span>
                    </td>

                    <td>
                      <code style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>
                        {st.templateName || 'Template Default'}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: TEMPLATE PESAN WHATSAPP */}
      {/* ============================================================ */}
      {activeTab === 'templates' && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>
                <span>📋</span>
                <span>Template Pesan WhatsApp Resmi (Meta Approved)</span>
              </h2>
              <div className={styles.sectionDescription}>
                Daftar template pesan yang digunakan untuk pengiriman notifikasi transaksional 24 jam sesuai kebijakan Meta.
              </div>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Nama Template</th>
                  <th>Kategori</th>
                  <th>Bahasa</th>
                  <th>Konten Pesan & Variabel</th>
                  <th>Status Meta</th>
                </tr>
              </thead>
              <tbody>
                {initialData.templates.map(tpl => (
                  <tr key={tpl.id}>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{tpl.templateName}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Meta Name: <code>{tpl.metaTemplateName}</code>
                      </div>
                    </td>

                    <td>
                      <span className={`${styles.badge} ${tpl.templateCategory === 'AUTHENTICATION' ? styles.badgeWarning : styles.badgeInfo}`}>
                        {tpl.templateCategory}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontWeight: 600 }}>{tpl.language.toUpperCase()}</span>
                    </td>

                    <td style={{ maxWidth: '420px', lineHeight: 1.5, fontSize: '0.85rem' }}>
                      <div style={{ backgroundColor: 'var(--surface-alt)', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        {tpl.content}
                      </div>
                    </td>

                    <td>
                      <span className={`${styles.badge} ${tpl.isActive ? styles.badgeSuccess : styles.badgeDanger}`}>
                        {tpl.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: RIWAYAT PENGIRIMAN PESAN */}
      {/* ============================================================ */}
      {activeTab === 'logs' && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>
                <span>📊</span>
                <span>Riwayat Pengiriman Pesan WhatsApp</span>
              </h2>
              <div className={styles.sectionDescription}>
                Log audit pengiriman pesan dan status tanda terima pengiriman (Sent, Delivered, Read, Failed).
              </div>
            </div>

            <button
              type="button"
              onClick={fetchLogs}
              disabled={isLoadingLogs}
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
            >
              {isLoadingLogs ? 'Memuat...' : '🔄 Segarkan'}
            </button>
          </div>

          {/* Filter Bar */}
          <div className={styles.filterBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Filter Status:</span>
              <select
                className={styles.select}
                value={logsFilterStatus}
                onChange={e => setLogsFilterStatus(e.target.value)}
                style={{ width: '140px', padding: '0.4rem 0.6rem' }}
              >
                <option value="ALL">Semua Status</option>
                <option value="SENT">SENT (Terkirim)</option>
                <option value="DELIVERED">DELIVERED (Sampai)</option>
                <option value="READ">READ (Dibaca)</option>
                <option value="FAILED">FAILED (Gagal)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Cari Permohonan:</span>
              <input
                type="text"
                className={styles.input}
                value={logsSearchAppId}
                onChange={e => setLogsSearchAppId(e.target.value)}
                placeholder="Nomor permohonan..."
                style={{ width: '180px', padding: '0.4rem 0.6rem' }}
              />
              <button
                type="button"
                onClick={fetchLogs}
                className={`${styles.btn} ${styles.btnPrimary}`}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
              >
                Cari
              </button>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            {isLoadingLogs ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Memuat riwayat pengiriman...
              </div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                Belum ada data pengiriman pesan WhatsApp yang tercatat.
              </div>
            ) : (
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Waktu Kirim</th>
                    <th>Penerima (Masked)</th>
                    <th>Template</th>
                    <th>Permohonan</th>
                    <th>Status Pengiriman</th>
                    <th>Pesan Kesalahan</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </td>

                      <td>
                        <strong style={{ fontFamily: 'monospace' }}>{log.recipientPhone}</strong>
                      </td>

                      <td>
                        <code style={{ fontSize: '0.8rem' }}>{log.templateName}</code>
                      </td>

                      <td>
                        {log.applicationId ? (
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--primary)' }}>
                            {log.applicationId}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      <td>
                        <span
                          className={`${styles.badge} ${
                            log.messageStatus === 'READ'
                              ? styles.badgeSuccess
                              : log.messageStatus === 'DELIVERED'
                              ? styles.badgeInfo
                              : log.messageStatus === 'SENT'
                              ? styles.badgeWarning
                              : styles.badgeDanger
                          }`}
                        >
                          {log.messageStatus === 'READ'
                            ? '✓✓ DIBACA'
                            : log.messageStatus === 'DELIVERED'
                            ? '✓✓ SAMPAI'
                            : log.messageStatus === 'SENT'
                            ? '✓ TERKIRIM'
                            : '✕ GAGAL'}
                        </span>
                      </td>

                      <td style={{ color: '#dc2626', fontSize: '0.8rem', maxWidth: '240px' }}>
                        {log.errorCode ? `${log.errorCode}: ${log.errorMessage || ''}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: KIRIM PESAN PERCOBAAN */}
      {/* ============================================================ */}
      {showTestModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: '0.75rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                💬 Kirim Pesan Percobaan WhatsApp
              </h3>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendTestMessage} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nomor WhatsApp Tujuan (Telah disetujui)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="Contoh: 08123456789 atau 628123456789"
                  required
                />
                <span className={styles.fieldDescription}>
                  Pesan uji coba akan dikirim melalui <strong>{provider === 'FONNTE' ? 'Fonnte WhatsApp Gateway' : 'Meta WhatsApp Cloud API'}</strong>. Pastikan nomor tujuan aktif di WhatsApp.
                </span>
              </div>

              {testSendResult && (
                <div className={`${styles.alertBox} ${testSendResult.success ? styles.alertSuccess : styles.alertError}`}>
                  <span>{testSendResult.success ? '✅' : '⚠️'}</span>
                  <div style={{ flex: 1 }}>
                    <strong>{testSendResult.success ? 'Pengiriman Berhasil' : 'Pengiriman Gagal'}</strong>
                    {testSendResult.success ? (
                      <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                        Pesan telah terkirim via {provider === 'FONNTE' ? 'Fonnte' : 'Meta Cloud API'}. Message ID: <code>{testSendResult.providerMessageId}</code>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                        {testSendResult.errorCode}: {testSendResult.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className={`${styles.btn} ${styles.btnSecondary}`}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  {isSendingTest ? 'Mengirim...' : 'Kirim Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

