'use server';

import { verifySession } from '@/lib/session';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import {
  getWhatsAppAdminViewData,
  getWhatsAppConfig,
  saveWhatsAppConfiguration
} from '@/lib/whatsapp/whatsapp-config-service';
import {
  testMetaWhatsAppConnection,
  sendMetaWhatsAppMessage
} from '@/lib/whatsapp/whatsapp-message-service';
import {
  testFonnteConnection,
  sendFonnteMessage
} from '@/lib/whatsapp/fonnte-service';
import { updateWhatsAppTemplate } from '@/lib/whatsapp/whatsapp-template-service';
import { maskPhone, normalizePhoneForWhatsApp } from '@/lib/whatsapp/crypto';
import {
  WhatsAppAdminViewData,
  WhatsAppConnectionTestResult,
  WhatsAppLogDTO,
  WhatsAppLogQueryFilters,
  WhatsAppSendResult
} from '@/lib/whatsapp/types';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Memastikan sesi pengguna aktif dan memiliki peran ADMIN.
 */
async function checkAdminSession() {
  const session = await verifySession();
  if (!session || session.role !== 'ADMIN') {
    throw new Error('Akses ditolak: Hanya Administrator Sistem yang berwenang mengelola konfigurasi WhatsApp.');
  }
  return session;
}

/**
 * Mengambil data konfigurasi WhatsApp lengkap untuk tampilan Admin.
 */
export async function getWhatsAppAdminConfigAction(): Promise<{
  success: boolean;
  data?: WhatsAppAdminViewData;
  error?: string;
}> {
  try {
    await checkAdminSession();
    const data = await getWhatsAppAdminViewData();
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Menyimpan konfigurasi provider WhatsApp (Meta Cloud API / Fonnte).
 */
export async function saveWhatsAppConfigAction(data: {
  provider?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  apiVersion?: string;
  senderPhone?: string;
  isEnabled: boolean;
  newAccessToken?: string;
  newAppSecret?: string;
  newWebhookVerifyToken?: string;
  newFonnteToken?: string;
}): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const session = await checkAdminSession();

    await saveWhatsAppConfiguration(data, session.userId);

    revalidatePath('/dashboard/admin/konfigurasi-wa');
    revalidatePath('/dashboard/admin/notifikasi');

    const providerName = data.provider === 'FONNTE' ? 'Fonnte WhatsApp Gateway' : 'WhatsApp Business Cloud API';
    return {
      success: true,
      message: `Konfigurasi ${providerName} berhasil disimpan secara terenkripsi.`
    };
  } catch (err: unknown) {
    return { success: false, message: 'Gagal menyimpan konfigurasi', error: getErrorMessage(err) };
  }
}

/**
 * Menjalankan uji koneksi ke provider WhatsApp aktif (Meta / Fonnte).
 */
export async function testWhatsAppConnectionAction(params?: {
  provider?: 'WHATSAPP_CLOUD_API' | 'FONNTE';
  phoneNumberId?: string;
  accessToken?: string;
  apiVersion?: string;
  fonnteToken?: string;
}): Promise<WhatsAppConnectionTestResult> {
  try {
    await checkAdminSession();
    const config = await getWhatsAppConfig();
    const targetProvider = params?.provider || config.provider;

    if (targetProvider === 'FONNTE') {
      return await testFonnteConnection(params?.fonnteToken);
    } else {
      return await testMetaWhatsAppConnection(params);
    }
  } catch (err: unknown) {
    return {
      success: false,
      message: getErrorMessage(err) || 'Pengujian koneksi gagal.'
    };
  }
}

/**
 * Mengirim pesan percobaan ke nomor telepon yang secara eksplisit ditentukan Admin.
 */
export async function sendWhatsAppTestMessageAction(
  destinationPhone: string
): Promise<WhatsAppSendResult> {
  try {
    const session = await checkAdminSession();
    const config = await getWhatsAppConfig();

    const normalized = normalizePhoneForWhatsApp(destinationPhone);
    if (!normalized || normalized.length < 10) {
      return {
        success: false,
        errorCode: 'INVALID_PHONE',
        errorMessage: 'Nomor telepon tujuan tidak valid. Masukkan nomor dengan format Indonesia (contoh: 08123456789).',
        recipientPhone: maskPhone(destinationPhone)
      };
    }

    const providerLabel = config.provider === 'FONNTE' ? 'Fonnte WhatsApp Gateway' : 'WhatsApp Business Cloud API Meta';
    const testText =
      `*Pesan Uji Coba Sistem Pelayanan Desa AI*\n\n` +
      `Halo! Ini adalah pesan uji coba resmi dari Sistem Pelayanan Desa melalui ${providerLabel}.\n\n` +
      `Waktu Uji: ${new Date().toLocaleString('id-ID')} WIB\n` +
      `Status: Integrasi Berhasil Terhubung ✅`;

    let result: WhatsAppSendResult;

    if (config.provider === 'FONNTE') {
      result = await sendFonnteMessage({
        to: normalized,
        message: testText
      });
    } else {
      result = await sendMetaWhatsAppMessage({
        to: normalized,
        templateName: 'pesan_uji_coba',
        textFallback: testText
      });
    }

    // Catat log pengiriman pesan percobaan
    try {
      await prisma.whatsAppMessageLog.create({
        data: {
          recipientPhone: normalized,
          templateName: 'pesan_uji_coba',
          messageStatus: result.success ? 'SENT' : 'FAILED',
          providerMessageId: result.providerMessageId || null,
          errorCode: result.errorCode || null,
          errorMessage: result.errorMessage || null,
          sentAt: result.success ? new Date() : null
        }
      });

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'SEND_WHATSAPP_TEST_MESSAGE',
          entityType: 'WhatsAppMessageLog',
          details: JSON.stringify({
            provider: config.provider,
            recipientMasked: maskPhone(normalized),
            success: result.success
          })
        }
      });
    } catch (logErr) {
      console.warn('[WhatsAppAction] Gagal mencatat log pesan uji coba:', logErr);
    }

    revalidatePath('/dashboard/admin/konfigurasi-wa');
    return result;
  } catch (err: unknown) {
    return {
      success: false,
      errorCode: 'UNAUTHORIZED',
      errorMessage: getErrorMessage(err) || 'Gagal mengirim pesan uji coba.',
      recipientPhone: maskPhone(destinationPhone)
    };
  }
}

/**
 * Mengaktifkan atau menonaktifkan saluran WhatsApp secara menyeluruh.
 */
export async function toggleWhatsAppEnabledAction(
  isEnabled: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await checkAdminSession();

    await saveWhatsAppConfiguration({ isEnabled }, session.userId);

    revalidatePath('/dashboard/admin/konfigurasi-wa');
    return {
      success: true,
      message: `WhatsApp Gateway berhasil ${isEnabled ? 'diaktifkan' : 'dinonaktifkan'}.`
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: getErrorMessage(err) || 'Gagal mengubah status WhatsApp.'
    };
  }
}

/**
 * Mengaktifkan/menonaktifkan pengaturan event notifikasi spesifik.
 */
export async function updateWhatsAppNotificationSettingAction(
  settingId: string,
  isEnabled: boolean,
  templateId?: string | null
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await checkAdminSession();

    const data: Prisma.WhatsAppNotificationSettingUpdateInput = { isEnabled };
    if (templateId !== undefined) {
      data.template = templateId ? { connect: { id: templateId } } : { disconnect: true };
    }

    await prisma.whatsAppNotificationSetting.update({
      where: { id: settingId },
      data
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'UPDATE_WHATSAPP_SETTING',
        entityType: 'WhatsAppNotificationSetting',
        entityId: settingId,
        details: JSON.stringify({ isEnabled, templateId })
      }
    });

    revalidatePath('/dashboard/admin/konfigurasi-wa');
    return { success: true, message: 'Pengaturan notifikasi berhasil diperbarui.' };
  } catch (err: unknown) {
    return { success: false, message: getErrorMessage(err) || 'Gagal memperbarui pengaturan notifikasi.' };
  }
}

/**
 * Memperbarui konten template pesan WhatsApp.
 */
export async function updateWhatsAppTemplateAction(
  templateId: string,
  data: {
    content?: string;
    templateCategory?: string;
    metaTemplateName?: string;
    isActive?: boolean;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await checkAdminSession();
    await updateWhatsAppTemplate(templateId, data, session.userId);

    revalidatePath('/dashboard/admin/konfigurasi-wa');
    return { success: true, message: 'Template pesan WhatsApp berhasil diperbarui.' };
  } catch (err: unknown) {
    return { success: false, message: getErrorMessage(err) || 'Gagal memperbarui template.' };
  }
}

/**
 * Mengambil riwayat log pengiriman WhatsApp dengan filter (Section I).
 * Akses dibatasi sesuai role pengguna.
 */
export async function getWhatsAppLogsAction(filters?: WhatsAppLogQueryFilters): Promise<{
  success: boolean;
  logs: WhatsAppLogDTO[];
  total: number;
  error?: string;
}> {
  try {
    const session = await verifySession();
    if (!session) {
      throw new Error('Unauthorized');
    }

    const where: Prisma.WhatsAppMessageLogWhereInput = {};

    // Filter berdasarkan role
    if (session.role === 'CITIZEN' || session.role === 'WARGA') {
      // Warga hanya bisa melihat pesan miliknya sendiri
      where.notification = { userId: session.userId };
    }

    // Filter status
    if (filters?.status && filters.status !== 'ALL') {
      where.messageStatus = filters.status.toUpperCase();
    }

    // Filter nomor permohonan
    if (filters?.applicationId) {
      where.applicationId = { contains: filters.applicationId };
    }

    // Filter tanggal
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const take = filters?.limit || 50;
    const skip = filters?.offset || 0;

    const [logs, total] = await Promise.all([
      prisma.whatsAppMessageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip
      }),
      prisma.whatsAppMessageLog.count({ where })
    ]);

    const logsDTO: WhatsAppLogDTO[] = logs.map(l => ({
      id: l.id,
      notificationId: l.notificationId,
      applicationId: l.applicationId,
      recipientPhone: maskPhone(l.recipientPhone),
      templateName: l.templateName,
      messageStatus: l.messageStatus,
      providerMessageId: l.providerMessageId,
      errorCode: l.errorCode,
      errorMessage: l.errorMessage,
      sentAt: l.sentAt ? l.sentAt.toISOString() : null,
      deliveredAt: l.deliveredAt ? l.deliveredAt.toISOString() : null,
      readAt: l.readAt ? l.readAt.toISOString() : null,
      createdAt: l.createdAt.toISOString()
    }));

    return { success: true, logs: logsDTO, total };
  } catch (err: unknown) {
    return { success: false, logs: [], total: 0, error: getErrorMessage(err) };
  }
}

