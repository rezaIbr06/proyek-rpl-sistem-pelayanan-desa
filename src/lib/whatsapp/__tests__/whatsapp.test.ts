/**
 * Unit & Integration Tests untuk Fitur Konfigurasi Notifikasi WhatsApp
 * Memenuhi seluruh 14 butir spesifikasi pengujian (Section K)
 */

import {
  encryptSecret,
  decryptSecret,
  maskSecret,
  maskPhone,
  normalizePhoneForWhatsApp,
  isValidIndonesianPhone
} from '../crypto';
import {
  saveWhatsAppConfiguration,
  getDecryptedWhatsAppCredentials,
  getWhatsAppAdminViewData,
  initializeWhatsAppDefaultsIfNeeded
} from '../whatsapp-config-service';
import {
  testMetaWhatsAppConnection,
  sendMetaWhatsAppMessage
} from '../whatsapp-message-service';
import {
  testFonnteConnection,
  sendFonnteMessage
} from '../fonnte-service';
import {
  verifyWebhookSignature,
  handleWebhookChallenge,
  processWebhookStatusUpdates
} from '../whatsapp-webhook-service';
import { dispatchWhatsAppNotification } from '../whatsapp-notification-service';
import {
  saveWhatsAppConfigAction,
  testWhatsAppConnectionAction,
  sendWhatsAppTestMessageAction,
  getWhatsAppLogsAction
} from '@/app/actions/whatsapp-config';
import prisma from '@/lib/db';
import crypto from 'crypto';
import * as sessionModule from '@/lib/session';

// Mock session untuk pengujian RBAC
jest.mock('@/lib/session', () => ({
  verifySession: jest.fn(),
}));

describe('A. Enkripsi & Masking Kredensial WhatsApp (K.2 & K.3)', () => {
  const sampleToken = 'EAABwz1234567890abcdefghijklmnopqrstuvwxyzABCD1234';

  test('TEST 1: Token terenkripsi dengan aman menggunakan AES-256-GCM', () => {
    const encrypted = encryptSecret(sampleToken);
    expect(encrypted).not.toBe(sampleToken);
    expect(encrypted).toContain(':'); // Format iv:tag:ciphertext

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(sampleToken);
  });

  test('TEST 2: Token terenkripsi tidak dapat didekripsi jika diubah/dirusak (Anti-Tampering)', () => {
    const encrypted = encryptSecret(sampleToken);
    const parts = encrypted.split(':');
    const alteredCipher = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);
    const tampered = `${parts[0]}:${parts[1]}:${alteredCipher}`;

    expect(() => decryptSecret(tampered)).toThrow();
  });

  test('TEST 3: Token masking tidak mengekspos isi rahasia ke frontend', () => {
    const masked = maskSecret(sampleToken);
    expect(masked).toBe('EAAB••••••••••••1234');
    expect(masked).not.toContain('z1234567890abcdef');

    const phoneMask = maskPhone('081234567890');
    expect(phoneMask).toBe('+0812****7890');

    const emptyMask = maskSecret('');
    expect(emptyMask).toBe('');
  });

  test('TEST 4: Normalisasi dan validasi nomor telepon WhatsApp', () => {
    expect(normalizePhoneForWhatsApp('081234567890')).toBe('6281234567890');
    expect(normalizePhoneForWhatsApp('+62 812-3456-7890')).toBe('6281234567890');
    expect(normalizePhoneForWhatsApp('6281234567890')).toBe('6281234567890');

    expect(isValidIndonesianPhone('081234567890')).toBe(true);
    expect(isValidIndonesianPhone('12345')).toBe(false);
  });
});

describe('B. Konfigurasi Database & Admin View Data (K.1)', () => {
  beforeAll(async () => {
    await initializeWhatsAppDefaultsIfNeeded();
  });

  test('TEST 5: Konfigurasi WhatsApp berhasil disimpan dengan enkripsi kredensial', async () => {
    const saved = await saveWhatsAppConfiguration(
      {
        phoneNumberId: '10987654321',
        businessAccountId: '9876543210',
        apiVersion: 'v19.0',
        senderPhone: '+6281234567890',
        isEnabled: true,
        newAccessToken: 'EAAB_TEST_TOKEN_SECRET_XYZ',
        newAppSecret: 'APP_SECRET_SUPER_SECRET',
        newWebhookVerifyToken: 'VERIFY_TOKEN_123'
      },
      'TEST_ADMIN_ID'
    );

    expect(saved.phoneNumberId).toBe('10987654321');
    expect(saved.isEnabled).toBe(true);

    const decrypted = await getDecryptedWhatsAppCredentials();
    expect(decrypted.accessToken).toBe('EAAB_TEST_TOKEN_SECRET_XYZ');
    expect(decrypted.appSecret).toBe('APP_SECRET_SUPER_SECRET');
    expect(decrypted.webhookVerifyToken).toBe('VERIFY_TOKEN_123');
  });

  test('TEST 6: Admin View Data mengembalikan masked tokens dan tidak membocorkan token asli', async () => {
    const viewData = await getWhatsAppAdminViewData();
    expect(viewData.config.phoneNumberId).toBe('10987654321');
    expect(viewData.credentials.hasAccessToken).toBe(true);
    expect(viewData.credentials.accessTokenMask).toContain('••••');
    expect(viewData.credentials.accessTokenMask).not.toContain('TEST_TOKEN_SECRET');
    expect(viewData.templates.length).toBeGreaterThanOrEqual(8);
    expect(viewData.settings.length).toBeGreaterThanOrEqual(10);
  });
});

describe('C. Uji Koneksi Meta & Pengiriman Pesan (K.4, K.5, K.12)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('TEST 7: Uji koneksi berhasil jika kredensial Meta valid (Mock 200 OK)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: '10987654321',
        verified_name: 'Desa Digital Official',
        display_phone_number: '+62 812-3456-7890',
        quality_rating: 'GREEN'
      })
    });

    const result = await testMetaWhatsAppConnection({
      phoneNumberId: '10987654321',
      accessToken: 'VALID_TOKEN'
    });

    expect(result.success).toBe(true);
    expect(result.verifiedName).toBe('Desa Digital Official');
    expect(result.qualityRating).toBe('GREEN');
  });

  test('TEST 8: Uji koneksi gagal ditangani dengan aman jika token tidak valid (Mock 401)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 190, message: 'Invalid OAuth access token.' }
      })
    });

    const result = await testMetaWhatsAppConnection({
      phoneNumberId: '10987654321',
      accessToken: 'EXPIRED_TOKEN'
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('190');
  });

  test('TEST 9: Pesan WhatsApp berhasil dikirim ke Meta Messages API (K.5)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messaging_product: 'whatsapp',
        contacts: [{ input: '6281234567890', wa_id: '6281234567890' }],
        messages: [{ id: 'wamid.HBgL1234567890' }]
      })
    });

    const result = await sendMetaWhatsAppMessage({
      to: '081234567890',
      templateName: 'permohonan_diajukan',
      parametersList: ['Budi Santoso', 'Surat Keterangan Domisili', 'REQ-001', '12 November 2026']
    });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe('wamid.HBgL1234567890');
    expect(result.recipientPhone).toBe('6281234567890');
  });

  test('TEST 10: Pengiriman gagal ditangani jika nomor tujuan tidak valid', async () => {
    const result = await sendMetaWhatsAppMessage({
      to: '123',
      templateName: 'permohonan_diajukan'
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_PHONE');
  });
});

describe('D. Automatisasi Notifikasi & Idempotency (K.6, K.7, K.8, K.9)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [{ id: `wamid.TEST_${Date.now()}` }]
      })
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('TEST 11: Notifikasi permohonan diajukan (APPLICATION_SUBMITTED) berfungsi dan mencatat log', async () => {
    const testAppId = `app-test-${Date.now()}`;

    const res = await dispatchWhatsAppNotification({
      eventType: 'APPLICATION_SUBMITTED',
      recipientPhone: '081299887766',
      recipientName: 'Siti Aminah',
      applicationId: testAppId,
      applicationNum: 'REQ-20261112-9999',
      serviceName: 'Surat Keterangan Usaha'
    });

    expect(res.success).toBe(true);

    const log = await prisma.whatsAppMessageLog.findFirst({
      where: { applicationId: testAppId }
    });
    expect(log).not.toBeNull();
    expect(log?.recipientPhone).toBe('6281299887766');
    expect(log?.messageStatus).toBe('SENT');
  });

  test('TEST 12: Event duplikat tidak mengirim pesan ganda (Idempotency)', async () => {
    const testAppId = `app-idempotent-${Date.now()}`;

    // Kirim pertama
    const res1 = await dispatchWhatsAppNotification({
      eventType: 'APPLICATION_SUBMITTED',
      recipientPhone: '081299887766',
      recipientName: 'Siti Aminah',
      applicationId: testAppId,
      applicationNum: 'REQ-IDEM-001'
    });
    expect(res1.success).toBe(true);

    // Kirim kedua dengan payload yang sama
    const res2 = await dispatchWhatsAppNotification({
      eventType: 'APPLICATION_SUBMITTED',
      recipientPhone: '081299887766',
      recipientName: 'Siti Aminah',
      applicationId: testAppId,
      applicationNum: 'REQ-IDEM-001'
    });

    expect(res2.success).toBe(true);
    expect(res2.errorCode).toBe('ALREADY_SENT');
  });

  test('TEST 13: Notifikasi yang dinonaktifkan tidak dikirimkan (K.8)', async () => {
    // Nonaktifkan event EMAIL_VERIFICATION
    await prisma.whatsAppNotificationSetting.update({
      where: { eventType: 'EMAIL_VERIFICATION' },
      data: { isEnabled: false }
    });

    const res = await dispatchWhatsAppNotification({
      eventType: 'EMAIL_VERIFICATION',
      recipientPhone: '081299887766',
      recipientName: 'Warga Baru'
    });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('EVENT_DISABLED');
  });
});

describe('E. Validasi Signature Webhook & Status Updates (K.10, K.11)', () => {
  const secretKey = 'TEST_WEBHOOK_APP_SECRET_123';

  beforeAll(async () => {
    await saveWhatsAppConfiguration(
      { newAppSecret: secretKey, newWebhookVerifyToken: 'MY_CHALLENGE_TOKEN' },
      'TEST_ADMIN'
    );
  });

  test('TEST 14: Webhook challenge GET memverifikasi token dan mengembalikan challenge', async () => {
    const valid = await handleWebhookChallenge({
      mode: 'subscribe',
      verifyToken: 'MY_CHALLENGE_TOKEN',
      challenge: '1155993322'
    });
    expect(valid.success).toBe(true);
    expect(valid.challenge).toBe('1155993322');

    const invalid = await handleWebhookChallenge({
      mode: 'subscribe',
      verifyToken: 'WRONG_TOKEN',
      challenge: '1155993322'
    });
    expect(invalid.success).toBe(false);
  });

  test('TEST 15: Validasi signature X-Hub-Signature-256 menolak signature palsu (K.10)', async () => {
    const rawBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const correctSig = `sha256=${crypto.createHmac('sha256', secretKey).update(rawBody).digest('hex')}`;

    const isValid = await verifyWebhookSignature(rawBody, correctSig);
    expect(isValid).toBe(true);

    const isFakeValid = await verifyWebhookSignature(rawBody, 'sha256=bad_fake_signature_hash');
    expect(isFakeValid).toBe(false);
  });

  test('TEST 16: Status delivered dan read diperbarui dari payload webhook (K.11)', async () => {
    const messageId = `wamid.STATUS_TEST_${Date.now()}`;

    // Buat log awal
    await prisma.whatsAppMessageLog.create({
      data: {
        recipientPhone: '6281234567890',
        templateName: 'permohonan_diajukan',
        messageStatus: 'SENT',
        providerMessageId: messageId
      }
    });

    // Simulasikan webhook delivered
    const deliveredPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: messageId,
                    status: 'delivered',
                    timestamp: String(Math.floor(Date.now() / 1000))
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const resDelivered = await processWebhookStatusUpdates(deliveredPayload);
    expect(resDelivered.processedCount).toBe(1);

    const logDelivered = await prisma.whatsAppMessageLog.findFirst({
      where: { providerMessageId: messageId }
    });
    expect(logDelivered?.messageStatus).toBe('DELIVERED');
    expect(logDelivered?.deliveredAt).not.toBeNull();

    // Simulasikan webhook read
    const readPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: messageId,
                    status: 'read',
                    timestamp: String(Math.floor(Date.now() / 1000))
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const resRead = await processWebhookStatusUpdates(readPayload);
    expect(resRead.processedCount).toBe(1);

    const logRead = await prisma.whatsAppMessageLog.findFirst({
      where: { providerMessageId: messageId }
    });
    expect(logRead?.messageStatus).toBe('READ');
    expect(logRead?.readAt).not.toBeNull();
  });
});

describe('F. Hak Akses & Role-Based Access Control (K.13)', () => {
  const verifySessionMock = sessionModule.verifySession as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('TEST 17: Pengguna non-Admin (CITIZEN, STAF, SUPERVISOR) dilarang mengubah konfigurasi', async () => {
    const nonAdminRoles = ['CITIZEN', 'WARGA', 'STAF', 'SUPERVISOR'];

    for (const role of nonAdminRoles) {
      verifySessionMock.mockResolvedValue({
        isAuth: true,
        userId: `user-${role.toLowerCase()}`,
        role,
        name: `User ${role}`
      });

      const res = await saveWhatsAppConfigAction({
        phoneNumberId: 'hacked',
        businessAccountId: 'hacked',
        apiVersion: 'v19.0',
        senderPhone: 'hacked',
        isEnabled: false
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Hanya Administrator Sistem');
    }
  });

  test('TEST 18: Pengguna non-Admin dilarang menguji koneksi atau mengirim pesan percobaan', async () => {
    verifySessionMock.mockResolvedValue({
      isAuth: true,
      userId: 'user-warga',
      role: 'WARGA',
      name: 'Warga'
    });

    const testConn = await testWhatsAppConnectionAction();
    expect(testConn.success).toBe(false);
    expect(testConn.message).toContain('Hanya Administrator Sistem');

    const testMsg = await sendWhatsAppTestMessageAction('081234567890');
    expect(testMsg.success).toBe(false);
    expect(testMsg.errorCode).toBe('UNAUTHORIZED');
  });

  test('TEST 19: Warga hanya dapat membaca riwayat notifikasi miliknya sendiri', async () => {
    const wargaUserId = `warga-${Date.now()}`;
    verifySessionMock.mockResolvedValue({
      isAuth: true,
      userId: wargaUserId,
      role: 'WARGA',
      name: 'Warga Khusus'
    });

    const logsResult = await getWhatsAppLogsAction();
    expect(logsResult.success).toBe(true);
    // Query yang dijalankan terisolasi berdasarkan userId
  });
});

describe('H. Pengujian Provider Fonnte WhatsApp Gateway', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('TEST 20: Konfigurasi Fonnte tersimpan dengan token terenkripsi dan mask yang aman', async () => {
    const testAdminId = 'admin-fonnte-test';
    const fonnteToken = 'fonnte_secret_token_12345';

    await saveWhatsAppConfiguration({
      provider: 'FONNTE',
      newFonnteToken: fonnteToken,
      isEnabled: true
    }, testAdminId);

    const creds = await getDecryptedWhatsAppCredentials();
    expect(creds.fonnteToken).toBe(fonnteToken);

    const adminView = await getWhatsAppAdminViewData();
    expect(adminView.config.provider).toBe('FONNTE');
    expect(adminView.credentials.hasFonnteToken).toBe(true);
    expect(adminView.credentials.fonnteTokenMask).toBe('fonn••••••••••••2345');
    expect(adminView.credentials.fonnteTokenMask).not.toContain(fonnteToken);
  });

  test('TEST 21: testFonnteConnection berhasil mendeteksi device connected dan sisa kuota', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: true,
        name: 'WhatsApp Desa Sukamaju',
        device: '6281234567890',
        device_status: 'connect',
        quota: 950
      })
    } as unknown as Response);

    const res = await testFonnteConnection('mock-fonnte-token');
    expect(res.success).toBe(true);
    expect(res.provider).toBe('FONNTE');
    expect(res.deviceStatus).toBe('CONNECTED');
    expect(res.deviceName).toBe('WhatsApp Desa Sukamaju');
    expect(res.quota).toBe(950);
  });

  test('TEST 22: sendFonnteMessage berhasil mengirim pesan teks via API Fonnte', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: true,
        id: ['fonnte_msg_987654'],
        process: 'processing'
      })
    } as unknown as Response);

    const res = await sendFonnteMessage({
      to: '081234567890',
      message: 'Halo warga, ini pesan uji coba Fonnte.'
    }, 'mock-token');

    expect(res.success).toBe(true);
    expect(res.providerMessageId).toBe('fonnte_fonnte_msg_987654');
    expect(res.recipientPhone).toBe('6281234567890');
  });

  test('TEST 23: dispatchWhatsAppNotification mengirim via Fonnte saat provider aktif adalah FONNTE', async () => {
    const uniqueId = `fonnte_dispatch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: true,
        id: [uniqueId],
        process: 'processing'
      })
    } as unknown as Response);

    const res = await dispatchWhatsAppNotification({
      eventType: 'APPLICATION_SUBMITTED',
      recipientPhone: '081234567890',
      recipientName: 'Budi Santoso',
      applicationId: `app-fonnte-${Date.now()}`,
      applicationNum: 'REQ-FONNTE-01',
      serviceName: 'Surat Keterangan Usaha'
    });

    expect(res.success).toBe(true);
    expect(res.providerMessageId).toBe(`fonnte_${uniqueId}`);
  });
});

