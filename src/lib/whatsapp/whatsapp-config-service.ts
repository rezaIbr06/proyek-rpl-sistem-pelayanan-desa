import prisma from '@/lib/db';
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_TEMPLATES, DEFAULT_WHATSAPP_CONFIG } from './constants';
import { decryptSecret, encryptSecret, maskSecret } from './crypto';
import {
  WhatsAppAdminViewData,
  WhatsAppConfigData,
  WhatsAppEventType,
  WhatsAppMessageType,
  WhatsAppRecipientType,
  WhatsAppTemplateCategory
} from './types';

export interface DecryptedWhatsAppCredentials {
  accessToken: string;
  appSecret: string;
  webhookVerifyToken: string;
  fonnteToken: string;
}

/**
 * Memastikan tabel WhatsAppConfiguration, WhatsAppTemplate, dan WhatsAppNotificationSetting
 * telah diinisialisasi dengan data default atau nilai dari environment variable.
 */
export async function initializeWhatsAppDefaultsIfNeeded() {
  const existingConfig = await prisma.whatsAppConfiguration.findFirst();

  if (!existingConfig) {
    const envToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    const envSecret = process.env.WHATSAPP_APP_SECRET || '';
    const envVerify = process.env.WHATSAPP_VERIFY_TOKEN || '';
    const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    const envApiVer = process.env.WHATSAPP_API_VERSION || 'v19.0';
    const envEnabled = process.env.WHATSAPP_ENABLED === 'true';
    const envFonnte = process.env.FONNTE_TOKEN || '';

    const initialProvider = (envFonnte && !envToken) ? 'FONNTE' : DEFAULT_WHATSAPP_CONFIG.provider;

    await prisma.whatsAppConfiguration.create({
      data: {
        provider: initialProvider,
        phoneNumberId: envPhoneId,
        businessAccountId: '',
        apiVersion: envApiVer,
        encryptedAccessToken: envToken ? encryptSecret(envToken.trim()) : null,
        encryptedAppSecret: envSecret ? encryptSecret(envSecret.trim()) : null,
        encryptedWebhookVerifyToken: envVerify ? encryptSecret(envVerify.trim()) : null,
        encryptedFonnteToken: envFonnte ? encryptSecret(envFonnte.trim()) : null,
        senderPhone: '',
        isEnabled: envEnabled,
        connectionStatus: (envToken && envPhoneId) || envFonnte ? 'CONFIGURED' : 'NOT_CONFIGURED',
        updatedBy: 'SYSTEM_INIT'
      }
    });
  } else if (!existingConfig.encryptedFonnteToken && process.env.FONNTE_TOKEN) {
    // Migrasi auto-sync Fonnte token dari .env ke database terenkripsi jika belum ada
    await prisma.whatsAppConfiguration.update({
      where: { id: existingConfig.id },
      data: {
        encryptedFonnteToken: encryptSecret(process.env.FONNTE_TOKEN.trim()),
        provider: existingConfig.encryptedAccessToken ? existingConfig.provider : 'FONNTE'
      }
    });
  }

  // Seed default templates jika belum ada
  const templateCount = await prisma.whatsAppTemplate.count();
  if (templateCount === 0) {
    for (const t of DEFAULT_TEMPLATES) {
      await prisma.whatsAppTemplate.create({
        data: {
          templateName: t.templateName,
          templateCategory: t.templateCategory,
          language: t.language,
          messageType: t.messageType,
          content: t.content,
          metaTemplateName: t.metaTemplateName,
          isActive: true
        }
      });
    }
  }

  // Seed default settings jika belum ada
  const settingCount = await prisma.whatsAppNotificationSetting.count();
  if (settingCount === 0) {
    const allTemplates = await prisma.whatsAppTemplate.findMany();
    const templateMap = new Map(allTemplates.map(tpl => [tpl.templateName, tpl.id]));

    for (const s of DEFAULT_NOTIFICATION_SETTINGS) {
      const templateId = templateMap.get(s.defaultTemplateName) || null;
      await prisma.whatsAppNotificationSetting.create({
        data: {
          eventType: s.eventType,
          name: s.name,
          description: s.description,
          isEnabled: s.isEnabled,
          recipientType: s.recipientType,
          templateId
        }
      });
    }
  }
}

/**
 * Mengambil konfigurasi WhatsApp aktif dari database.
 */
export async function getWhatsAppConfig(): Promise<WhatsAppConfigData> {
  await initializeWhatsAppDefaultsIfNeeded();

  const config = await prisma.whatsAppConfiguration.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (!config) {
    return {
      provider: DEFAULT_WHATSAPP_CONFIG.provider,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: '',
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0',
      senderPhone: '',
      isEnabled: process.env.WHATSAPP_ENABLED === 'true',
      connectionStatus: 'NOT_CONFIGURED'
    };
  }

  return {
    id: config.id,
    provider: config.provider,
    phoneNumberId: config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: config.businessAccountId || '',
    apiVersion: config.apiVersion || process.env.WHATSAPP_API_VERSION || 'v19.0',
    senderPhone: config.senderPhone || '',
    isEnabled: config.isEnabled,
    connectionStatus: config.connectionStatus,
    lastTestedAt: config.lastTestedAt,
    lastErrorMessage: config.lastErrorMessage,
    updatedBy: config.updatedBy,
    updatedAt: config.updatedAt
  };
}

/**
 * Mengambil kredensial yang didekripsi untuk keperluan pemanggilan backend WhatsApp API.
 * TIDAK PERNAH DIKIRIM KE BROWSER / FRONTEND.
 */
export async function getDecryptedWhatsAppCredentials(): Promise<DecryptedWhatsAppCredentials> {
  const config = await prisma.whatsAppConfiguration.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  let accessToken = '';
  let appSecret = '';
  let webhookVerifyToken = '';
  let fonnteToken = '';

  if (config) {
    if (config.encryptedAccessToken) {
      try {
        accessToken = decryptSecret(config.encryptedAccessToken);
      } catch (err) {
        console.error('[WhatsAppConfig] Gagal mendekripsi Access Token:', err);
      }
    }

    if (config.encryptedAppSecret) {
      try {
        appSecret = decryptSecret(config.encryptedAppSecret);
      } catch (err) {
        console.error('[WhatsAppConfig] Gagal mendekripsi App Secret:', err);
      }
    }

    if (config.encryptedWebhookVerifyToken) {
      try {
        webhookVerifyToken = decryptSecret(config.encryptedWebhookVerifyToken);
      } catch (err) {
        console.error('[WhatsAppConfig] Gagal mendekripsi Webhook Verify Token:', err);
      }
    }

    if (config.encryptedFonnteToken) {
      try {
        fonnteToken = decryptSecret(config.encryptedFonnteToken);
      } catch (err) {
        console.error('[WhatsAppConfig] Gagal mendekripsi Fonnte Token:', err);
      }
    }
  }

  // Fallback ke environment variable jika belum terkonfigurasi di database
  if (!accessToken && process.env.WHATSAPP_ACCESS_TOKEN) {
    accessToken = process.env.WHATSAPP_ACCESS_TOKEN.trim();
  }
  if (!appSecret && process.env.WHATSAPP_APP_SECRET) {
    appSecret = process.env.WHATSAPP_APP_SECRET.trim();
  }
  if (!webhookVerifyToken && process.env.WHATSAPP_VERIFY_TOKEN) {
    webhookVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN.trim();
  }
  if (!fonnteToken && process.env.FONNTE_TOKEN) {
    fonnteToken = process.env.FONNTE_TOKEN.trim();
  }

  return { accessToken, appSecret, webhookVerifyToken, fonnteToken };
}

/**
 * Mengambil data untuk halaman Admin tanpa membocorkan token asli (menggunakan mask).
 */
export async function getWhatsAppAdminViewData(): Promise<WhatsAppAdminViewData> {
  await initializeWhatsAppDefaultsIfNeeded();

  const config = await getWhatsAppConfig();

  const creds = await getDecryptedWhatsAppCredentials();

  const hasAccessToken = Boolean(creds.accessToken);
  const hasAppSecret = Boolean(creds.appSecret);
  const hasWebhookVerifyToken = Boolean(creds.webhookVerifyToken);
  const hasFonnteToken = Boolean(creds.fonnteToken);

  const accessTokenMask = hasAccessToken ? maskSecret(creds.accessToken) : '';
  const appSecretMask = hasAppSecret ? maskSecret(creds.appSecret) : '';
  const webhookVerifyTokenMask = hasWebhookVerifyToken ? maskSecret(creds.webhookVerifyToken) : '';
  const fonnteTokenMask = hasFonnteToken ? maskSecret(creds.fonnteToken) : '';

  // Ambil pengaturan notifikasi
  const settings = await prisma.whatsAppNotificationSetting.findMany({
    include: { template: true },
    orderBy: { createdAt: 'asc' }
  });

  const settingsDTO = settings.map(s => ({
    id: s.id,
    eventType: s.eventType as WhatsAppEventType,
    name: s.name,
    description: s.description,
    isEnabled: s.isEnabled,
    recipientType: s.recipientType as WhatsAppRecipientType,
    templateId: s.templateId,
    templateName: s.template?.templateName || null,
    templateContent: s.template?.content || null
  }));

  // Ambil template
  const templates = await prisma.whatsAppTemplate.findMany({
    orderBy: { createdAt: 'asc' }
  });

  const templatesDTO = templates.map(t => ({
    id: t.id,
    templateName: t.templateName,
    templateCategory: t.templateCategory as WhatsAppTemplateCategory,
    language: t.language,
    messageType: t.messageType as WhatsAppMessageType,
    content: t.content,
    metaTemplateName: t.metaTemplateName,
    isActive: t.isActive
  }));

  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const webhookUrl = `${appBaseUrl.replace(/\/+$/, '')}/api/webhook/whatsapp`;

  return {
    config,
    credentials: {
      hasAccessToken,
      hasAppSecret,
      hasWebhookVerifyToken,
      hasFonnteToken,
      accessTokenMask,
      appSecretMask,
      webhookVerifyTokenMask,
      fonnteTokenMask
    },
    settings: settingsDTO,
    templates: templatesDTO,
    webhookUrl
  };
}

/**
 * Menyimpan konfigurasi provider WhatsApp oleh Administrator.
 */
export async function saveWhatsAppConfiguration(
  input: {
    provider?: string;
    phoneNumberId?: string;
    businessAccountId?: string;
    apiVersion?: string;
    senderPhone?: string;
    isEnabled?: boolean;
    newAccessToken?: string;
    newAppSecret?: string;
    newWebhookVerifyToken?: string;
    newFonnteToken?: string;
  },
  adminUserId: string
): Promise<WhatsAppConfigData> {
  await initializeWhatsAppDefaultsIfNeeded();

  const existing = await prisma.whatsAppConfiguration.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  const dataPayload: {
    provider?: string;
    phoneNumberId?: string;
    businessAccountId?: string;
    apiVersion?: string;
    senderPhone?: string;
    isEnabled?: boolean;
    encryptedAccessToken?: string;
    encryptedAppSecret?: string;
    encryptedWebhookVerifyToken?: string;
    encryptedFonnteToken?: string;
    updatedBy?: string;
  } = {
    updatedBy: adminUserId
  };

  if (input.provider !== undefined) dataPayload.provider = input.provider;
  if (input.phoneNumberId !== undefined) dataPayload.phoneNumberId = input.phoneNumberId.trim();
  if (input.businessAccountId !== undefined) dataPayload.businessAccountId = input.businessAccountId.trim();
  if (input.apiVersion !== undefined) dataPayload.apiVersion = input.apiVersion.trim() || 'v19.0';
  if (input.senderPhone !== undefined) dataPayload.senderPhone = input.senderPhone.trim();
  if (input.isEnabled !== undefined) dataPayload.isEnabled = Boolean(input.isEnabled);

  // Enkripsi kredensial baru jika diisi
  if (input.newAccessToken && input.newAccessToken.trim().length > 0) {
    dataPayload.encryptedAccessToken = encryptSecret(input.newAccessToken.trim());
  }

  if (input.newAppSecret && input.newAppSecret.trim().length > 0) {
    dataPayload.encryptedAppSecret = encryptSecret(input.newAppSecret.trim());
  }

  if (input.newWebhookVerifyToken && input.newWebhookVerifyToken.trim().length > 0) {
    dataPayload.encryptedWebhookVerifyToken = encryptSecret(input.newWebhookVerifyToken.trim());
  }

  if (input.newFonnteToken && input.newFonnteToken.trim().length > 0) {
    dataPayload.encryptedFonnteToken = encryptSecret(input.newFonnteToken.trim());
  }

  let saved;
  if (existing) {
    saved = await prisma.whatsAppConfiguration.update({
      where: { id: existing.id },
      data: dataPayload
    });
  } else {
    saved = await prisma.whatsAppConfiguration.create({
      data: {
        provider: dataPayload.provider || 'WHATSAPP_CLOUD_API',
        phoneNumberId: dataPayload.phoneNumberId || '',
        businessAccountId: dataPayload.businessAccountId || '',
        apiVersion: dataPayload.apiVersion || 'v19.0',
        senderPhone: dataPayload.senderPhone || '',
        isEnabled: dataPayload.isEnabled ?? false,
        encryptedAccessToken: dataPayload.encryptedAccessToken || '',
        encryptedAppSecret: dataPayload.encryptedAppSecret || '',
        encryptedWebhookVerifyToken: dataPayload.encryptedWebhookVerifyToken || '',
        encryptedFonnteToken: dataPayload.encryptedFonnteToken || '',
        updatedBy: dataPayload.updatedBy
      }
    });
  }

  // Audit Log aman tanpa mencatat token rahasia
  let validUserId: string | null = null;
  if (adminUserId) {
    const user = await prisma.user.findUnique({ where: { id: adminUserId }, select: { id: true } });
    if (user) validUserId = user.id;
  }

  await prisma.auditLog.create({
    data: {
      userId: validUserId,
      action: 'UPDATE_WHATSAPP_CONFIGURATION',
      entityType: 'WhatsAppConfiguration',
      entityId: saved.id,
      details: JSON.stringify({
        provider: saved.provider,
        phoneNumberId: saved.phoneNumberId,
        businessAccountId: saved.businessAccountId,
        apiVersion: saved.apiVersion,
        senderPhone: saved.senderPhone,
        isEnabled: saved.isEnabled,
        updatedAccessToken: Boolean(input.newAccessToken),
        updatedAppSecret: Boolean(input.newAppSecret),
        updatedVerifyToken: Boolean(input.newWebhookVerifyToken),
        updatedFonnteToken: Boolean(input.newFonnteToken)
      })
    }
  });

  return {
    id: saved.id,
    provider: saved.provider,
    phoneNumberId: saved.phoneNumberId,
    businessAccountId: saved.businessAccountId,
    apiVersion: saved.apiVersion,
    senderPhone: saved.senderPhone,
    isEnabled: saved.isEnabled,
    connectionStatus: saved.connectionStatus,
    lastTestedAt: saved.lastTestedAt,
    lastErrorMessage: saved.lastErrorMessage,
    updatedBy: saved.updatedBy,
    updatedAt: saved.updatedAt
  };
}

/**
 * Memperbarui status koneksi WhatsApp setelah pengujian.
 */
export async function updateWhatsAppConnectionStatus(
  status: 'CONNECTED' | 'FAILED' | 'NOT_CONFIGURED',
  errorMessage?: string | null
) {
  const existing = await prisma.whatsAppConfiguration.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (existing) {
    await prisma.whatsAppConfiguration.update({
      where: { id: existing.id },
      data: {
        connectionStatus: status,
        lastTestedAt: new Date(),
        lastErrorMessage: errorMessage || null
      }
    });
  }
}

