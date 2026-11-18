import crypto from 'crypto';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getDecryptedWhatsAppCredentials } from './whatsapp-config-service';

/**
 * Memvalidasi signature webhook dari Meta menggunakan App Secret (X-Hub-Signature-256).
 */
export async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const creds = await getDecryptedWhatsAppCredentials();
  const appSecret = creds.appSecret;

  if (!appSecret) {
    // Jika appSecret belum diset, return false demi keamanan
    return false;
  }

  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;

  try {
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const actualBuf = Buffer.from(signatureHeader, 'utf8');
    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Menangani tantangan verifikasi webhook saat setup awal di Meta App Dashboard (GET request).
 */
export async function handleWebhookChallenge(params: {
  mode: string | null;
  verifyToken: string | null;
  challenge: string | null;
}): Promise<{ success: boolean; challenge?: string; error?: string }> {
  const creds = await getDecryptedWhatsAppCredentials();
  const configuredToken = creds.webhookVerifyToken;

  if (!configuredToken) {
    return { success: false, error: 'Webhook Verify Token belum dikonfigurasi di server.' };
  }

  if (params.mode === 'subscribe' && params.verifyToken === configuredToken && params.challenge) {
    return { success: true, challenge: params.challenge };
  }

  return { success: false, error: 'Token verifikasi tidak sesuai atau mode tidak valid.' };
}

interface WebhookStatusItem {
  id: string; // provider message ID (wamid)
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id?: string;
  errors?: Array<{ code: number; title: string; message?: string }>;
}

/**
 * Memproses pembaruan status pesan WhatsApp dari Meta Webhook (POST request).
 * Terapkan idempotency agar urutan status tidak berbalik (misal: read lalu delivered).
 */
export async function processWebhookStatusUpdates(payload: Record<string, unknown>): Promise<{ processedCount: number }> {
  if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
    return { processedCount: 0 };
  }

  let count = 0;

  for (const entry of payload.entry) {
    const changes = entry.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const statuses: WebhookStatusItem[] = change.value?.statuses;
      if (!Array.isArray(statuses)) continue;

      for (const item of statuses) {
        const messageId = item.id;
        const metaStatus = item.status?.toLowerCase();
        const eventDate = item.timestamp ? new Date(Number(item.timestamp) * 1000) : new Date();

        const statusRank: Record<string, number> = {
          pending: 1,
          sent: 2,
          delivered: 3,
          read: 4,
          failed: 5
        };

        const targetStatus = metaStatus.toUpperCase();

        try {
          // 1. Perbarui WhatsAppMessageLog
          const existingLog = await prisma.whatsAppMessageLog.findFirst({
            where: { providerMessageId: messageId }
          });

          if (existingLog) {
            const currentRank = statusRank[existingLog.messageStatus.toLowerCase()] || 0;
            const newRank = statusRank[metaStatus] || 0;

            // Jangan turunkan status yang sudah lebih lanjut (misal jangan ubah READ menjadi DELIVERED)
            const shouldUpdateStatus = newRank >= currentRank || targetStatus === 'FAILED';

            const logUpdate: Prisma.WhatsAppMessageLogUpdateInput = {};
            if (shouldUpdateStatus) logUpdate.messageStatus = targetStatus;

            if (metaStatus === 'delivered' && !existingLog.deliveredAt) {
              logUpdate.deliveredAt = eventDate;
            } else if (metaStatus === 'read' && !existingLog.readAt) {
              logUpdate.readAt = eventDate;
            } else if (metaStatus === 'sent' && !existingLog.sentAt) {
              logUpdate.sentAt = eventDate;
            }

            if (metaStatus === 'failed' && item.errors && item.errors.length > 0) {
              logUpdate.errorCode = `WA_ERR_${item.errors[0].code}`;
              logUpdate.errorMessage = item.errors[0].message || item.errors[0].title;
            }

            await prisma.whatsAppMessageLog.update({
              where: { id: existingLog.id },
              data: logUpdate
            });
          }

          // 2. Perbarui NotificationDelivery (untuk sinkronisasi riwayat dashboard)
          const existingDelivery = await prisma.notificationDelivery.findFirst({
            where: { providerMessageId: messageId }
          });

          if (existingDelivery) {
            const deliveryUpdate: Prisma.NotificationDeliveryUpdateInput = {};
            if (targetStatus === 'DELIVERED') {
              deliveryUpdate.status = 'DELIVERED';
              deliveryUpdate.deliveredAt = eventDate;
            } else if (targetStatus === 'READ') {
              deliveryUpdate.status = 'READ';
              deliveryUpdate.readAt = eventDate;
            } else if (targetStatus === 'FAILED') {
              deliveryUpdate.status = 'FAILED';
              if (item.errors && item.errors.length > 0) {
                deliveryUpdate.errorCode = `WA_ERR_${item.errors[0].code}`;
              }
            }

            if (Object.keys(deliveryUpdate).length > 0) {
              await prisma.notificationDelivery.update({
                where: { id: existingDelivery.id },
                data: deliveryUpdate
              });
            }
          }

          count++;
        } catch (dbErr) {
          console.error(`[WhatsAppWebhook] Gagal memperbarui status untuk message ${messageId}:`, dbErr);
        }
      }
    }
  }

  return { processedCount: count };
}

