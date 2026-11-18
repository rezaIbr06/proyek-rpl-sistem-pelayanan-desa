/**
 * WhatsApp Gateway Provider.
 *
 * Provider Utama: Meta WhatsApp Business Cloud API (Graph API)
 * Disimpan secara terenkripsi di database dan dapat dikonfigurasi melalui dashboard Admin.
 *
 * Mendukung fallback ke Fonnte jika dikonfigurasi secara opsional.
 * Semua operasi berjalan di server-side.
 * Token tidak pernah di-log atau dikirim ke browser.
 */

import type { NotificationPayload, DeliveryResult } from './types';
import { buildWhatsAppTextMessage } from './templates';
import { getWhatsAppConfig, getDecryptedWhatsAppCredentials } from '@/lib/whatsapp/whatsapp-config-service';
import { dispatchWhatsAppNotification } from '@/lib/whatsapp/whatsapp-notification-service';
import { WhatsAppNotificationEventType } from '@/lib/whatsapp/types';

const FONNTE_TOKEN = process.env.FONNTE_TOKEN ?? '';
const REQUEST_TIMEOUT_MS = 15_000;

/** Mask nomor telepon untuk log aman: +62812****5678 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return '****';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 8) return '****';
  const prefix = cleaned.slice(0, 4);
  const suffix = cleaned.slice(-4);
  return `+${prefix}${'*'.repeat(Math.max(4, cleaned.length - 8))}${suffix}`;
}

/** Validasi format nomor telepon */
function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 9 && cleaned.length <= 15;
}

/** Normalisasi nomor untuk Fonnte (format: 628xxx) */
function normalizePhoneForFonnte(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  return cleaned;
}

/** Kirim pesan menggunakan Fonnte WhatsApp Gateway (Fallback Sekunder) */
async function sendViaFonnte(
  phone: string,
  payload: NotificationPayload
): Promise<DeliveryResult> {
  const target = normalizePhoneForFonnte(phone);
  const message = buildWhatsAppTextMessage(payload);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: FONNTE_TOKEN,
      },
      body: JSON.stringify({
        target,
        message,
        countryCode: '62',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      id?: string[];
      reason?: string;
      target?: string[];
    };

    if (!res.ok || data.status === false) {
      const reason = data.reason ? `FONNTE_${data.reason.toUpperCase().replace(/\s+/g, '_')}` : `HTTP_${res.status}`;
      console.error(`[WhatsApp/Fonnte] Gagal kirim ke ${maskPhone(phone)}: ${reason}`);
      return { channel: 'WHATSAPP', success: false, errorCode: reason };
    }

    const messageId = Array.isArray(data.id) && data.id.length > 0
      ? String(data.id[0])
      : (data.id !== undefined && data.id !== null ? String(data.id) : undefined);
    console.info(`[WhatsApp/Fonnte] Terkirim ke ${maskPhone(phone)}, event: ${payload.eventType}`);
    return { channel: 'WHATSAPP', success: true, providerMessageId: messageId };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`[WhatsApp/Fonnte] Timeout kirim ke ${maskPhone(phone)}`);
      return { channel: 'WHATSAPP', success: false, errorCode: 'TIMEOUT' };
    }
    console.error(`[WhatsApp/Fonnte] Network error ke ${maskPhone(phone)}`);
    return { channel: 'WHATSAPP', success: false, errorCode: 'NETWORK_ERROR' };
  }
}

/** Pemetaan event type permohonan ke WhatsAppNotificationEventType */
function mapToWhatsAppEventType(eventType: string): WhatsAppNotificationEventType {
  switch (eventType) {
    case 'SUBMITTED':
      return 'APPLICATION_SUBMITTED';
    case 'PROCESSING':
      return 'APPLICATION_PROCESSING';
    case 'REVISION_REQUIRED':
      return 'APPLICATION_REVISION_REQUIRED';
    case 'APPROVED':
      return 'APPLICATION_APPROVED';
    case 'REJECTED':
      return 'APPLICATION_REJECTED';
    case 'COMPLETED':
      return 'APPLICATION_COMPLETED';
    case 'ACCOUNT_REGISTRATION':
      return 'ACCOUNT_REGISTRATION';
    case 'EMAIL_VERIFICATION':
      return 'EMAIL_VERIFICATION';
    case 'STAFF_NEW_APPLICATION':
      return 'STAFF_NEW_APPLICATION';
    default:
      return 'APPLICATION_SUBMITTED';
  }
}

export async function sendWhatsAppNotification(
  payload: NotificationPayload
): Promise<DeliveryResult> {
  const config = await getWhatsAppConfig();
  const creds = await getDecryptedWhatsAppCredentials();

  if (!config.isEnabled) {
    return { channel: 'WHATSAPP', success: false, errorCode: 'CHANNEL_DISABLED' };
  }

  const phone = payload.phoneNumber?.trim();
  if (!phone || !isValidPhone(phone)) {
    return { channel: 'WHATSAPP', success: false, errorCode: 'INVALID_PHONE' };
  }

  const hasMeta = Boolean(config.phoneNumberId && creds.accessToken);
  const hasFonnte = Boolean(creds.fonnteToken);

  // 1. Prioritas Utama: gunakan provider yang dipilih Admin di dashboard
  if (config.provider === 'FONNTE' && hasFonnte) {
    const waEventType = mapToWhatsAppEventType(payload.eventType);

    const result = await dispatchWhatsAppNotification({
      eventType: waEventType,
      recipientPhone: phone,
      recipientName: payload.citizenName,
      applicationId: payload.applicationId,
      applicationNum: payload.applicationNum,
      serviceName: payload.serviceName,
      publicNotes: payload.publicNotes,
      statusLabel: payload.status,
      submissionDate: payload.changedAt || new Date()
    });

    return {
      channel: 'WHATSAPP',
      success: result.success,
      providerMessageId: result.providerMessageId,
      errorCode: result.errorCode
    };
  }

  // 2. Meta WhatsApp Business Cloud API
  if (hasMeta) {
    const waEventType = mapToWhatsAppEventType(payload.eventType);

    const result = await dispatchWhatsAppNotification({
      eventType: waEventType,
      recipientPhone: phone,
      recipientName: payload.citizenName,
      applicationId: payload.applicationId,
      applicationNum: payload.applicationNum,
      serviceName: payload.serviceName,
      publicNotes: payload.publicNotes,
      statusLabel: payload.status,
      submissionDate: payload.changedAt || new Date()
    });

    return {
      channel: 'WHATSAPP',
      success: result.success,
      providerMessageId: result.providerMessageId,
      errorCode: result.errorCode
    };
  }

  // 3. Fallback sekunder: Fonnte via database credential atau env FONNTE_TOKEN
  if (hasFonnte || FONNTE_TOKEN) {
    return sendViaFonnte(phone, payload);
  }

  console.warn('[WhatsApp] Integrasi belum dikonfigurasi (Meta Cloud API atau Fonnte).');
  return { channel: 'WHATSAPP', success: false, errorCode: 'NOT_CONFIGURED' };
}
