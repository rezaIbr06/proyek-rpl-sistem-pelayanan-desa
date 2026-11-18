/**
 * Notification Service - Orkestrator pengiriman notifikasi eksternal.
 *
 * Alur:
 * 1. Buat record Notification di DB (internal bell)
 * 2. Buat NotificationDelivery records per channel (PENDING)
 * 3. Dispatch pengiriman secara paralel (WhatsApp + Email)
 * 4. Update status delivery di DB
 *
 * Idempotency: cek apakah delivery untuk eventType + applicationId + channel
 * sudah ada dengan status SENT agar tidak kirim ganda.
 *
 * Retry: maksimal MAX_ATTEMPTS kali, hanya untuk error NETWORK_ERROR atau TIMEOUT.
 */

import prisma from '@/lib/db'
import { sendWhatsAppNotification } from './whatsapp-provider'
import { sendEmailNotification } from './email-provider'
import { maskPhone } from './whatsapp-provider'
import { maskEmail } from './email-provider'
import type {
  NotificationPayload,
  NotificationChannel,
  DeliveryResult,
  NotificationDispatchResult,
} from './types'

const MAX_ATTEMPTS = 3
const RETRYABLE_ERRORS = new Set(['NETWORK_ERROR', 'TIMEOUT', 'CONNECTION_REFUSED'])

/** Apakah error ini layak di-retry */
function isRetryable(errorCode?: string): boolean {
  return !!errorCode && RETRYABLE_ERRORS.has(errorCode)
}

/** Delay eksponensial sederhana */
async function delay(attempt: number) {
  const ms = Math.min(1000 * 2 ** attempt, 8000)
  return new Promise((r) => setTimeout(r, ms))
}

/** Kirim satu channel dengan retry terbatas */
async function sendWithRetry(
  channel: NotificationChannel,
  payload: NotificationPayload,
  deliveryId: string
): Promise<DeliveryResult> {
  const sender =
    channel === 'WHATSAPP' ? sendWhatsAppNotification : sendEmailNotification

  let result: DeliveryResult = { channel, success: false, errorCode: 'NOT_ATTEMPTED' }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Update status PROCESSING
    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: 'PROCESSING', attemptCount: attempt + 1 },
    })

    result = await sender(payload)

    if (result.success) break
    if (!isRetryable(result.errorCode)) break
    if (attempt < MAX_ATTEMPTS - 1) await delay(attempt)
  }

  // Update status final
  await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: result.success ? 'SENT' : 'FAILED',
      providerMessageId: result.providerMessageId ? String(result.providerMessageId) : null,
      errorCode: result.errorCode ?? null,
      sentAt: result.success ? new Date() : null,
    },
  })

  return result
}

/**
 * Kirim notifikasi eksternal setelah transaksi DB utama berhasil.
 *
 * @param userId - User ID penerima (Warga)
 * @param payload - Data konteks permohonan
 * @param internalTitle - Judul untuk notifikasi bell internal
 * @param internalMessage - Pesan untuk notifikasi bell internal
 * @param applicationId - ID permohonan untuk link
 */
export async function dispatchNotification(
  userId: string,
  payload: NotificationPayload,
  internalTitle: string,
  internalMessage: string
): Promise<NotificationDispatchResult> {
  // === IDEMPOTENCY CHECK ===
  // Cek apakah sudah ada delivery SENT untuk event + application + channel yang sama
  const existingSent = await prisma.notificationDelivery.findMany({
    where: {
      notification: {
        userId,
        applicationId: payload.applicationId,
      },
      eventType: payload.eventType,
      status: 'SENT',
    },
    select: { channel: true },
  })

  const alreadySentChannels = new Set(existingSent.map((d) => d.channel as NotificationChannel))

  // === BUAT NOTIFICATION INTERNAL (bell) ===
  // Gunakan upsert-like logic: cek apakah sudah ada notifikasi untuk event ini
  const notification = await prisma.notification.create({
    data: {
      userId,
      applicationId: payload.applicationId,
      title: internalTitle,
      message: internalMessage,
    },
  })

  const results: DeliveryResult[] = []

  // === PREPARE DELIVERY RECORDS ===
  const channels: NotificationChannel[] = ['WHATSAPP', 'EMAIL']
  const deliveryIds: Partial<Record<NotificationChannel, string>> = {}

  for (const channel of channels) {
    if (alreadySentChannels.has(channel)) {
      console.info(`[NotifService] Idempotent: ${channel} sudah dikirim untuk event ${payload.eventType} appId ${payload.applicationId}`)
      results.push({ channel, success: true, errorCode: 'ALREADY_SENT' })
      continue
    }

    const recipient = channel === 'WHATSAPP'
      ? (payload.phoneNumber ? maskPhone(payload.phoneNumber) : 'no_phone')
      : (payload.email ? maskEmail(payload.email) : 'no_email')

    const delivery = await prisma.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        eventType: payload.eventType,
        channel,
        recipientMasked: recipient,
        status: 'PENDING',
        attemptCount: 0,
      },
    })

    deliveryIds[channel] = delivery.id
  }

  // === KIRIM SECARA PARALEL ===
  const sendPromises: Promise<DeliveryResult>[] = []

  for (const channel of channels) {
    const deliveryId = deliveryIds[channel]
    if (!deliveryId) continue // sudah ALREADY_SENT, skip

    sendPromises.push(
      sendWithRetry(channel, payload, deliveryId).catch((err) => {
        // Tangkap error tak terduga agar channel lain tetap jalan
        console.error(`[NotifService] Unexpected error channel ${channel}:`, err instanceof Error ? err.message : 'unknown')
        return { channel, success: false, errorCode: 'UNEXPECTED_ERROR' } as DeliveryResult
      })
    )
  }

  const sendResults = await Promise.allSettled(sendPromises)
  for (const r of sendResults) {
    if (r.status === 'fulfilled') results.push(r.value)
  }

  return { notificationId: notification.id, results }
}

/**
 * Ambil riwayat delivery untuk Admin dashboard.
 * Data yang dikembalikan menggunakan recipient yang sudah disamarkan.
 */
export async function getDeliveryHistory(limit = 50) {
  return prisma.notificationDelivery.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      channel: true,
      eventType: true,
      recipientMasked: true,
      status: true,
      attemptCount: true,
      errorCode: true,
      createdAt: true,
      sentAt: true,
      deliveredAt: true,
      readAt: true,
      // Jangan return providerMessageId ke klien
      notification: {
        select: {
          applicationId: true,
          user: { select: { name: true } },
        },
      },
    },
  })
}
