import prisma from '@/lib/db';
import { getWhatsAppConfig } from './whatsapp-config-service';
import { renderTemplateText } from './whatsapp-template-service';
import { sendMetaWhatsAppMessage } from './whatsapp-message-service';
import { sendFonnteMessage } from './fonnte-service';
import { maskPhone, normalizePhoneForWhatsApp } from './crypto';
import { WhatsAppNotificationEventType, WhatsAppSendResult } from './types';

export interface DispatchWhatsAppParams {
  eventType: WhatsAppNotificationEventType;
  recipientPhone: string;
  recipientName: string;
  applicationId?: string;
  applicationNum?: string;
  serviceName?: string;
  publicNotes?: string;
  statusLabel?: string;
  submissionDate?: Date | string;
  estimatedDays?: number;
  notificationId?: string;
}

/**
 * Menyusun daftar parameter terurut untuk template resmi Meta berdasarkan tipe event.
 */
function buildPositionalParameters(eventType: WhatsAppNotificationEventType, params: DispatchWhatsAppParams): string[] {
  const { recipientName, applicationNum, serviceName, publicNotes, statusLabel, submissionDate, estimatedDays } = params;

  const dateFormatted = submissionDate instanceof Date
    ? submissionDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : (submissionDate || new Date().toLocaleDateString('id-ID'));

  switch (eventType) {
    case 'ACCOUNT_REGISTRATION':
      return [recipientName];

    case 'EMAIL_VERIFICATION':
      return [recipientName];

    case 'APPLICATION_SUBMITTED':
      return [recipientName, serviceName || 'Pelayanan Desa', applicationNum || '-', dateFormatted];

    case 'APPLICATION_PROCESSING':
      return [recipientName, applicationNum || '-'];

    case 'APPLICATION_REVISION_REQUIRED':
      return [recipientName, applicationNum || '-', publicNotes || 'Dokumen belum lengkap'];

    case 'APPLICATION_APPROVED':
      return [recipientName, applicationNum || '-'];

    case 'APPLICATION_REJECTED':
      return [recipientName, applicationNum || '-', publicNotes || 'Belum memenuhi syarat'];

    case 'APPLICATION_COMPLETED':
      return [recipientName, applicationNum || '-'];

    case 'STAFF_NEW_APPLICATION':
      return [applicationNum || '-', recipientName];

    case 'STAFF_FOLLOW_UP':
      return [applicationNum || '-', serviceName || 'Pelayanan Desa'];

    case 'STAFF_SLA_OVERDUE':
      return [applicationNum || '-', String(estimatedDays || 3)];

    default:
      return [recipientName, applicationNum || '-', statusLabel || ''];
  }
}

/**
 * Menyusun kamus variabel bernama untuk substitusi lokal.
 */
function buildNamedVariables(params: DispatchWhatsAppParams): Record<string, string> {
  const dateFormatted = params.submissionDate instanceof Date
    ? params.submissionDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : (params.submissionDate || new Date().toLocaleDateString('id-ID'));

  return {
    nama_warga: params.recipientName,
    nomor_permohonan: params.applicationNum || '-',
    nama_layanan: params.serviceName || 'Pelayanan Desa',
    tanggal_pengajuan: dateFormatted,
    alasan_perbaikan: params.publicNotes || 'Dokumen belum lengkap',
    alasan_penolakan: params.publicNotes || 'Belum memenuhi persyaratan',
    estimasi_hari: String(params.estimatedDays || 3)
  };
}

/**
 * Mengirim notifikasi WhatsApp otomatis berbasis event.
 * Memvalidasi apakah event aktif, melakukan pemeriksaan idempotency, dan mencatat log transaksi.
 */
export async function dispatchWhatsAppNotification(params: DispatchWhatsAppParams): Promise<WhatsAppSendResult> {
  const config = await getWhatsAppConfig();

  // 1. Cek apakah provider WhatsApp aktif global
  if (!config.isEnabled) {
    return {
      success: false,
      errorCode: 'CHANNEL_DISABLED',
      errorMessage: 'WhatsApp Gateway sedang dinonaktifkan di pengaturan sistem.',
      recipientPhone: maskPhone(params.recipientPhone)
    };
  }

  // 2. Cek apakah jenis event notifikasi ini diaktifkan oleh Admin
  const setting = await prisma.whatsAppNotificationSetting.findUnique({
    where: { eventType: params.eventType },
    include: { template: true }
  });

  if (!setting || !setting.isEnabled) {
    console.info(`[WhatsAppNotification] Event ${params.eventType} dinonaktifkan oleh pengaturan sistem.`);
    return {
      success: false,
      errorCode: 'EVENT_DISABLED',
      errorMessage: `Notifikasi untuk event ${params.eventType} sedang dinonaktifkan di sistem.`,
      recipientPhone: maskPhone(params.recipientPhone)
    };
  }

  const normalizedPhone = normalizePhoneForWhatsApp(params.recipientPhone);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    return {
      success: false,
      errorCode: 'INVALID_PHONE',
      errorMessage: 'Nomor telepon tujuan tidak valid.',
      recipientPhone: maskPhone(params.recipientPhone)
    };
  }

  // 3. IDEMPOTENCY CHECK: cegah pesan ganda untuk event & permohonan yang sama
  if (params.applicationId) {
    const existingSentLog = await prisma.whatsAppMessageLog.findFirst({
      where: {
        applicationId: params.applicationId,
        templateName: setting.template?.templateName || params.eventType,
        messageStatus: { in: ['SENT', 'DELIVERED', 'READ'] }
      }
    });

    if (existingSentLog) {
      console.info(`[WhatsAppNotification] Idempotent: Notifikasi ${params.eventType} untuk appId ${params.applicationId} sudah pernah terkirim.`);
      return {
        success: true,
        providerMessageId: existingSentLog.providerMessageId || undefined,
        errorCode: 'ALREADY_SENT',
        errorMessage: 'Pesan sudah pernah dikirim sebelumnya.',
        recipientPhone: maskPhone(normalizedPhone)
      };
    }
  }

  // 4. Resolusi Template Pesan
  const template = setting.template;
  const metaTemplateName = template?.metaTemplateName || setting.template?.templateName || params.eventType.toLowerCase();
  const parametersList = buildPositionalParameters(params.eventType, params);
  const namedVariables = buildNamedVariables(params);

  const fallbackText = template?.content
    ? renderTemplateText(template.content, namedVariables)
    : `Yth. ${params.recipientName}, status permohonan ${params.applicationNum || ''} telah diperbarui.`;

  // 5. Eksekusi pengiriman berdasarkan provider aktif
  let sendResult: WhatsAppSendResult;

  if (config.provider === 'FONNTE') {
    // Fonnte mode: kirim teks yang sudah dirender (bukan template Meta)
    sendResult = await sendFonnteMessage({
      to: normalizedPhone,
      message: fallbackText
    });
  } else {
    // Meta Cloud API mode: kirim template resmi
    sendResult = await sendMetaWhatsAppMessage({
      to: normalizedPhone,
      templateName: metaTemplateName,
      languageCode: template?.language || 'id',
      parametersList,
      bodyVariables: namedVariables,
      textFallback: fallbackText,
      applicationId: params.applicationId,
      notificationId: params.notificationId
    });
  }

  // 6. Simpan log pengiriman ke database (WhatsAppMessageLog)
  try {
    await prisma.whatsAppMessageLog.create({
      data: {
        notificationId: params.notificationId || null,
        applicationId: params.applicationId || null,
        recipientPhone: normalizedPhone,
        templateName: template?.templateName || metaTemplateName,
        messageStatus: sendResult.success ? 'SENT' : 'FAILED',
        providerMessageId: sendResult.providerMessageId || null,
        errorCode: sendResult.errorCode || null,
        errorMessage: sendResult.errorMessage || null,
        sentAt: sendResult.success ? new Date() : null
      }
    });
  } catch (logErr) {
    console.error('[WhatsAppNotification] Gagal mencatat log pesan ke database:', logErr);
  }

  return sendResult;
}

