'use client';

import React, { useState, useTransition } from 'react';
import { AIAdminViewData, ConnectionTestResult } from '@/lib/ai/types';
import { saveAIConfigAction, testAIConnectionAction, resetAISystemPromptAction } from '@/app/actions/ai-config';
import styles from './aiConfig.module.css';

interface Props {
  initialData: AIAdminViewData;
}

export default function AIConfigManager({ initialData }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isTesting, setIsTesting] = useState(false);

  // Form states
  const [provider, setProvider] = useState(initialData.config.provider || 'NVIDIA');
  const [baseUrl, setBaseUrl] = useState(initialData.config.baseUrl || 'https://integrate.api.nvidia.com/v1');
  const [modelId, setModelId] = useState(initialData.config.modelId || 'meta/llama-3.2-11b-vision-instruct');
  const [customModel, setCustomModel] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Model parameters
  const [temperature, setTemperature] = useState<number>(initialData.config.temperature ?? 0.2);
  const [topP, setTopP] = useState<number>(initialData.config.topP ?? 0.8);
  const [maxTokens, setMaxTokens] = useState<number>(initialData.config.maxTokens ?? 1024);
  const [timeout, setTimeoutVal] = useState<number>(initialData.config.timeout ?? 30000);
  const [streamingEnabled, setStreamingEnabled] = useState<boolean>(initialData.config.streamingEnabled ?? true);
  const [isEnabled, setIsEnabled] = useState<boolean>(initialData.config.isEnabled ?? true);

  // Behavior settings
  const [assistantName, setAssistantName] = useState(initialData.config.assistantName || 'Asisten Desa AI');
  const [assistantDescription, setAssistantDescription] = useState(
    initialData.config.assistantDescription || 'Asisten kecerdasan buatan resmi untuk pelayanan administrasi desa.'
  );
  const [responseLanguage, setResponseLanguage] = useState(initialData.config.responseLanguage || 'Indonesia');
  const [useKnowledgeBase, setUseKnowledgeBase] = useState<boolean>(initialData.config.useKnowledgeBase ?? true);
  const [useDatabaseStats, setUseDatabaseStats] = useState<boolean>(initialData.config.useDatabaseStats ?? true);
  const [fallbackMessage, setFallbackMessage] = useState(
    initialData.config.fallbackMessage ||
      'Maaf, informasi tersebut belum tersedia dalam basis data resmi desa. Silakan hubungi petugas desa untuk informasi lebih lanjut.'
  );
  const [systemPrompt, setSystemPrompt] = useState(initialData.config.systemPrompt || '');

  // Status & Feedback
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Current credential metadata
  const [credMeta, setCredMeta] = useState(initialData.credential);

  // Provider metadata
  const currentProviderMeta = initialData.supportedProviders.find(p => p.id === provider) || initialData.supportedProviders[0];

  // Handler: Change provider
  const handleProviderChange = (newProv: string) => {
    setProvider(newProv);
    const meta = initialData.supportedProviders.find(p => p.id === newProv);
    if (meta) {
      setBaseUrl(meta.defaultBaseUrl);
      setModelId(meta.defaultModel);
    }
    setTestResult(null);
  };

  // Handler: Test Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setNotification(null);
    setTestResult(null);

    const activeModel = modelId === 'CUSTOM' ? customModel.trim() : modelId;
    if (!activeModel) {
      setTestResult({
        success: false,
        message: 'Silakan tentukan Model ID terlebih dahulu.',
        provider,
        modelId: ''
      });
      setIsTesting(false);
      return;
    }

    try {
      const result = await testAIConnectionAction({
        provider,
        modelId: activeModel,
        baseUrl,
        customApiKey: newApiKey.trim() || undefined
      });

      setTestResult(result);

      if (result.success) {
        setCredMeta(prev => ({
          ...prev,
          status: 'TEST_SUCCESS',
          lastTestedAt: new Date().toISOString(),
          lastErrorMessage: null
        }));
      } else {
        setCredMeta(prev => ({
          ...prev,
          status: 'TEST_FAILED',
          lastTestedAt: new Date().toISOString(),
          lastErrorMessage: result.message
        }));
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setTestResult({
        success: false,
        message: errMsg || 'Pengujian koneksi gagal.',
        provider,
        modelId: activeModel
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Handler: Save Configuration
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    const activeModel = modelId === 'CUSTOM' ? customModel.trim() : modelId;
    if (!activeModel) {
      setNotification({ type: 'error', message: 'Model ID tidak boleh kosong.' });
      return;
    }

    startTransition(async () => {
      const res = await saveAIConfigAction({
        provider,
        modelId: activeModel,
        baseUrl,
        temperature,
        topP,
        maxTokens,
        timeout,
        streamingEnabled,
        isEnabled,
        systemPrompt,
        assistantName,
        assistantDescription,
        responseLanguage,
        useKnowledgeBase,
        useDatabaseStats,
        fallbackMessage,
        newApiKey: newApiKey.trim() || undefined
      });

      if (res.success) {
        setNotification({ type: 'success', message: res.message });
        if (newApiKey.trim()) {
          setCredMeta(prev => ({
            ...prev,
            hasKey: true,
            keyMask: newApiKey.startsWith('nvapi-')
              ? `nvapi-••••••••••••${newApiKey.slice(-4)}`
              : '••••••••••••••••'
          }));
          setNewApiKey(''); // Clear entered raw key
        }
      } else {
        setNotification({ type: 'error', message: res.error || res.message });
      }
    });
  };

  // Handler: Reset System Prompt
  const handleResetPrompt = async () => {
    if (confirm('Apakah Anda yakin ingin mengembalikan System Prompt ke standar resmi desa?')) {
      const res = await resetAISystemPromptAction();
      if (res.success) {
        setSystemPrompt(res.defaultPrompt);
        setNotification({ type: 'success', message: 'System prompt berhasil dikembalikan ke standar resmi default.' });
      }
    }
  };

  return (
    <form onSubmit={handleSave} className={styles.pageContainer}>
      {/* Page Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>
            <span>⚙️</span>
            <span>Konfigurasi Model AI</span>
          </h1>
          <p className={styles.pageSubtitle}>
            Kelola provider LLM, model komputasi, parameter inferensi, dan batas kepatuhan perilaku asisten desa.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || isPending}
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            {isTesting ? (
              <>
                <span className="spinner-border" style={{ width: '1rem', height: '1rem' }}>⏳</span>
                <span>Menguji...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Uji Koneksi</span>
              </>
            )}
          </button>

          <button
            type="submit"
            disabled={isPending || isTesting}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            {isPending ? (
              <>
                <span className="spinner-border" style={{ width: '1rem', height: '1rem' }}>💾</span>
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Simpan Konfigurasi</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Notifications */}
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

      {/* Test Connection Result Box */}
      {testResult && (
        <div className={`${styles.alertBox} ${testResult.success ? styles.alertSuccess : styles.alertError}`}>
          <span style={{ fontSize: '1.25rem' }}>{testResult.success ? '🎉' : '❌'}</span>
          <div style={{ flex: 1 }}>
            <strong>{testResult.success ? 'Uji Koneksi Sukses' : 'Uji Koneksi Gagal'}:</strong>
            <div style={{ marginTop: '0.25rem' }}>{testResult.message}</div>
            {testResult.latencyMs !== undefined && (
              <div style={{ marginTop: '0.2rem', fontSize: '0.8rem', opacity: 0.85 }}>
                Latensi Provider: <strong>{testResult.latencyMs} ms</strong> | Model: <strong>{testResult.modelId}</strong>
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

      {/* System Status Overview Bar */}
      <div className={styles.statusCard}>
        <div className={styles.statusIndicator}>
          <div
            className={`${styles.statusDot} ${
              !isEnabled
                ? styles.statusDotInactive
                : credMeta.status === 'TEST_SUCCESS'
                ? styles.statusDotActive
                : credMeta.status === 'TEST_FAILED'
                ? styles.statusDotInactive
                : styles.statusDotWarn
            }`}
          />
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Status Asisten AI: {isEnabled ? 'Aktif' : 'Dinonaktifkan'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Provider Aktif: <strong>{provider}</strong> ({modelId})
              {credMeta.lastTestedAt && (
                <span> &bull; Uji Terakhir: {new Date(credMeta.lastTestedAt).toLocaleString('id-ID')}</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={isEnabled}
              onChange={e => setIsEnabled(e.target.checked)}
            />
            <div className={`${styles.toggleTrack} ${isEnabled ? styles.toggleTrackActive : ''}`}>
              <div className={`${styles.toggleThumb} ${isEnabled ? styles.toggleThumbActive : ''}`} />
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {isEnabled ? 'Layanan Terbuka' : 'Layanan Ditutup'}
            </span>
          </label>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 1. PENGATURAN PROVIDER */}
      {/* ============================================================ */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>
              <span>🏢</span>
              <span>1. Pengaturan Provider AI</span>
            </h2>
            <div className={styles.sectionDescription}>
              Konfigurasi koneksi penyedia LLM, alamat endpoint inferensi, dan kredensial API Key yang terenkripsi.
            </div>
          </div>
          <span className={`${styles.badge} ${credMeta.hasKey ? styles.badgeSuccess : styles.badgeWarning}`}>
            {credMeta.hasKey ? 'Kredensial Tersimpan' : 'Belum Ada Key'}
          </span>
        </div>

        <div className={styles.sectionBody}>
          <div className={styles.formGrid}>
            {/* Nama Provider */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Penyedia AI (Provider)</label>
              <select
                className={styles.select}
                value={provider}
                onChange={e => handleProviderChange(e.target.value)}
              >
                {initialData.supportedProviders.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.id === 'NVIDIA' ? '(Utama)' : '(Adapter)'}
                  </option>
                ))}
              </select>
              <span className={styles.fieldDescription}>
                {currentProviderMeta.description}
              </span>
            </div>

            {/* API Base URL */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>API Base URL</label>
              <input
                type="text"
                className={styles.input}
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://integrate.api.nvidia.com/v1"
                required
              />
              <span className={styles.fieldDescription}>
                Endpoint resmi inferensi API (misal: <code>https://integrate.api.nvidia.com/v1</code>).
              </span>
            </div>
          </div>

          {/* API Key Credential Input & Mask */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              <span>API Key Provider ({provider})</span>
              {credMeta.keyMask && (
                <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                  Tersimpan: <code style={{ color: 'var(--primary)' }}>{credMeta.keyMask}</code>
                </span>
              )}
            </label>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                className={styles.input}
                value={newApiKey}
                onChange={e => setNewApiKey(e.target.value)}
                placeholder={
                  credMeta.hasKey
                    ? 'Biarkan kosong untuk mempertahankan API Key yang sudah tersimpan'
                    : 'Masukkan API Key resmi (contoh: nvapi-...)'
                }
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className={`${styles.btn} ${styles.btnSecondary}`}
                title="Tampilkan/Sembunyikan ketikan"
                style={{ padding: '0.5rem 0.85rem' }}
              >
                {showApiKey ? '🙈' : '👁️'}
              </button>
            </div>

            <div className={styles.fieldDescription} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
              <span>🛡️</span>
              <span>
                <strong>Keamanan Server:</strong> API Key disimpan secara terenkripsi menggunakan algoritma AES-256-GCM.
                Nilai asli tidak pernah dikirim kembali ke browser.
              </span>
            </div>
          </div>

          {/* Provider Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.5rem' }}>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || isPending}
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              <span>🧪</span>
              <span>Uji Koneksi Provider Ini</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEnabled(true)}
              className={`${styles.btn} ${styles.btnSuccess}`}
              disabled={isEnabled}
            >
              <span>✅</span>
              <span>Aktifkan Provider Ini</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. PENGATURAN MODEL */}
      {/* ============================================================ */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>
              <span>🤖</span>
              <span>2. Pengaturan Model & Parameter Inferensi</span>
            </h2>
            <div className={styles.sectionDescription}>
              Tentukan model ID spesifik dan sesuaikan parameter sampling untuk menjamin jawaban akurat dan deterministik.
            </div>
          </div>
        </div>

        <div className={styles.sectionBody}>
          {/* Model ID Selection */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Pilih Model ID</label>
            <select
              className={styles.select}
              value={modelId}
              onChange={e => setModelId(e.target.value)}
            >
              {currentProviderMeta.recommendedModels.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.contextWindow}) — {m.id}
                </option>
              ))}
              <option value="CUSTOM">+ Masukkan Model ID Kustom...</option>
            </select>

            {modelId === 'CUSTOM' && (
              <div style={{ marginTop: '0.5rem' }}>
                <input
                  type="text"
                  className={styles.input}
                  value={customModel}
                  onChange={e => setCustomModel(e.target.value)}
                  placeholder="Ketik nama model ID lengkap (misal: meta/llama-3.2-11b-vision-instruct)"
                  required
                />
              </div>
            )}
            <span className={styles.fieldDescription}>
              Model yang dipilih harus tersedia pada akun inferensi provider yang aktif.
            </span>
          </div>

          {/* Temperature & Top P */}
          <div className={styles.formGrid}>
            {/* Temperature */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <span>Temperature (Keacakan)</span>
                <span className={styles.sliderValue}>{temperature.toFixed(2)}</span>
              </label>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  min="0.0"
                  max="1.5"
                  step="0.05"
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className={styles.sliderInput}
                />
                <input
                  type="number"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value) || 0)}
                  className={styles.input}
                  style={{ width: '80px', padding: '0.35rem 0.5rem' }}
                />
              </div>
              <span className={styles.fieldDescription}>
                Mengatur derajat keacakan jawaban. Nilai rendah (<strong>0.1 - 0.3</strong>) sangat disarankan untuk layanan desa agar jawaban deterministik, faktual, dan patuh pada database.
              </span>
            </div>

            {/* Top P */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <span>Top P (Nucleus Sampling)</span>
                <span className={styles.sliderValue}>{topP.toFixed(2)}</span>
              </label>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={topP}
                  onChange={e => setTopP(parseFloat(e.target.value))}
                  className={styles.sliderInput}
                />
                <input
                  type="number"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={topP}
                  onChange={e => setTopP(parseFloat(e.target.value) || 0.8)}
                  className={styles.input}
                  style={{ width: '80px', padding: '0.35rem 0.5rem' }}
                />
              </div>
              <span className={styles.fieldDescription}>
                Membatasi probabilitas kumulatif pemilihan kata alternatif. Nilai <strong>0.8</strong> memberikan stabilitas kata yang baik.
              </span>
            </div>
          </div>

          {/* Max Tokens & Timeout */}
          <div className={styles.formGrid}>
            {/* Maximum Tokens */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Batas Token Maksimal (Max Tokens)</label>
              <input
                type="number"
                min="64"
                max="4096"
                step="64"
                value={maxTokens}
                onChange={e => setMaxTokens(parseInt(e.target.value, 10) || 1024)}
                className={styles.input}
                required
              />
              <span className={styles.fieldDescription}>
                Batas panjang respons maksimal dalam satu pesan. Nilai default: <strong>1024 tokens</strong> (cukup untuk penjelasan syarat dokumen dan alur pelayanan).
              </span>
            </div>

            {/* Request Timeout */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Batas Waktu Tunggu (Request Timeout - ms)</label>
              <input
                type="number"
                min="3000"
                max="60000"
                step="1000"
                value={timeout}
                onChange={e => setTimeoutVal(parseInt(e.target.value, 10) || 30000)}
                className={styles.input}
                required
              />
              <span className={styles.fieldDescription}>
                Durasi maksimal dalam milidetik (misal: <strong>30000 ms</strong> = 30 detik) sebelum permintaan beralih ke fallback darurat jika provider mengalami antrean.
              </span>
            </div>
          </div>

          {/* Streaming Toggle */}
          <div className={styles.formGroup} style={{ paddingTop: '0.5rem' }}>
            <label className={styles.toggleSwitch}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={streamingEnabled}
                onChange={e => setStreamingEnabled(e.target.checked)}
              />
              <div className={`${styles.toggleTrack} ${streamingEnabled ? styles.toggleTrackActive : ''}`}>
                <div className={`${styles.toggleThumb} ${streamingEnabled ? styles.toggleThumbActive : ''}`} />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Aktifkan Streaming Jawaban (Server-Sent Events)
                </div>
                <div className={styles.fieldDescription}>
                  Mengirimkan kata demi kata secara real-time ke antarmuka chat warga untuk latensi awal yang responsif.
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. PENGATURAN PERILAKU AI */}
      {/* ============================================================ */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>
              <span>🛡️</span>
              <span>3. Pengaturan Perilaku & Batas Pengetahuan AI</span>
            </h2>
            <div className={styles.sectionDescription}>
              Tetapkan identitas asisten, batasan domain Database-Only, dan aturan penolakan terhadap halusinasi / topik terlarang.
            </div>
          </div>
          <span className={`${styles.badge} ${styles.badgeInfo}`}>
            Database-Only Enforced
          </span>
        </div>

        <div className={styles.sectionBody}>
          <div className={styles.formGrid}>
            {/* Nama Asisten */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nama Asisten AI</label>
              <input
                type="text"
                className={styles.input}
                value={assistantName}
                onChange={e => setAssistantName(e.target.value)}
                placeholder="Asisten Desa AI"
                required
              />
              <span className={styles.fieldDescription}>
                Nama panggilan resmi asisten yang dikenali oleh warga saat berinteraksi.
              </span>
            </div>

            {/* Bahasa Jawaban */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Bahasa Jawaban Utama</label>
              <select
                className={styles.select}
                value={responseLanguage}
                onChange={e => setResponseLanguage(e.target.value)}
              >
                <option value="Indonesia">Bahasa Indonesia (Standar Resmi)</option>
                <option value="Jawa">Bahasa Jawa (Krama / Ngoko Halus)</option>
                <option value="Sunda">Bahasa Sunda (Lemes)</option>
              </select>
              <span className={styles.fieldDescription}>
                Bahasa pengantar komunikasi yang diprioritaskan saat menyapa dan menerangkan informasi.
              </span>
            </div>
          </div>

          {/* Deskripsi Asisten */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Deskripsi Singkat Asisten</label>
            <input
              type="text"
              className={styles.input}
              value={assistantDescription}
              onChange={e => setAssistantDescription(e.target.value)}
              placeholder="Asisten kecerdasan buatan resmi untuk pelayanan administrasi desa."
              required
            />
          </div>

          {/* Batasan Domain & Kebijakan Kepatuhan */}
          <div style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🔒</span>
              <span>Kebijakan Kepatuhan Sistem (System Compliance Matrix)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {/* Database Only Mode - Locked */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px' }}>✓</div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Mode Database-Only: AKTIF</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Terkunci paten oleh kebijakan sistem</div>
                </div>
              </div>

              {/* Anti Programming */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px' }}>✕</div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Permintaan Koding: DILARANG</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Menolak kueri Python, JS, SQL, dsb.</div>
                </div>
              </div>

              {/* General Web Knowledge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px' }}>✕</div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Pertanyaan Umum Bebas: DILARANG</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hanya menjawab 5W+1H seputar desa</div>
                </div>
              </div>

              {/* Privacy */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px' }}>✓</div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Privasi Warga: DILINDUNGI</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Isolasi data antar akun pemohon</div>
                </div>
              </div>
            </div>
          </div>

          {/* Knowledge Base & Database Stats Toggles */}
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={useKnowledgeBase}
                  onChange={e => setUseKnowledgeBase(e.target.checked)}
                />
                <div className={`${styles.toggleTrack} ${useKnowledgeBase ? styles.toggleTrackActive : ''}`}>
                  <div className={`${styles.toggleThumb} ${useKnowledgeBase ? styles.toggleThumbActive : ''}`} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Gunakan Knowledge Base AI Desa
                  </div>
                  <div className={styles.fieldDescription}>
                    Izinkan model mengambil referensi artikel panduan dan syarat layanan yang dipublikasikan.
                  </div>
                </div>
              </label>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={useDatabaseStats}
                  onChange={e => setUseDatabaseStats(e.target.checked)}
                />
                <div className={`${styles.toggleTrack} ${useDatabaseStats ? styles.toggleTrackActive : ''}`}>
                  <div className={`${styles.toggleThumb} ${useDatabaseStats ? styles.toggleThumbActive : ''}`} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Kueri Statistik Database Otomatis
                  </div>
                  <div className={styles.fieldDescription}>
                    Izinkan asisten menjawab rekap jumlah permohonan dan warga secara langsung dari SQL server.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Pesan Fallback */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Pesan Fallback (Jika Informasi Tidak Ditemukan)</label>
            <textarea
              rows={2}
              className={styles.textarea}
              value={fallbackMessage}
              onChange={e => setFallbackMessage(e.target.value)}
              required
            />
            <span className={styles.fieldDescription}>
              Jawaban baku yang wajib dikembalikan saat data resmi tidak tercatat dalam database desa.
            </span>
          </div>

          {/* System Prompt Editor */}
          <div className={styles.formGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className={styles.formLabel} style={{ margin: 0 }}>
                <span>Aturan System Prompt Terpusat</span>
              </label>
              <button
                type="button"
                onClick={handleResetPrompt}
                className={`${styles.btn} ${styles.btnSecondary}`}
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              >
                <span>🔄</span>
                <span>Kembalikan ke Default</span>
              </button>
            </div>

            <textarea
              rows={12}
              className={`${styles.textarea} ${styles.textareaCode}`}
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              required
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Perubahan prompt berlaku langsung pada kueri percakapan warga selanjutnya.</span>
              <span>{systemPrompt.length} karakter</span>
            </div>
          </div>
        </div>

        {/* Card Footer Submit Button */}
        <div className={styles.footerActions}>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || isPending}
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            <span>⚡</span>
            <span>Uji Koneksi</span>
          </button>

          <button
            type="submit"
            disabled={isPending || isTesting}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            {isPending ? 'Menyimpan Konfigurasi...' : 'Simpan Semua Konfigurasi'}
          </button>
        </div>
      </div>
    </form>
  );
}
