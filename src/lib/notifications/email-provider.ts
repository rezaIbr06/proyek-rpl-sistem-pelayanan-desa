/**
 * Gmail SMTP email provider menggunakan Nodemailer.
 *
 * Metode autentikasi: Gmail OAuth2 (GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN)
 * atau App Password (GMAIL_APP_PASSWORD + GMAIL_SENDER_EMAIL).
 *
 * Kredensial TIDAK pernah di-log atau dikirim ke browser.
 */

import type { NotificationPayload, DeliveryResult } from './types'
import { buildEmailTemplate } from './templates'

const ENABLED = process.env.GMAIL_ENABLED === 'true'
const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL ?? ''
const CLIENT_ID = process.env.GMAIL_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET ?? ''
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN ?? ''
const APP_PASSWORD = process.env.GMAIL_APP_PASSWORD ?? ''
const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000'

const REQUEST_TIMEOUT_MS = 30_000

/** Mask email untuk log aman: a***@gmail.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '****'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}***@${domain}`
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** Lazy import nodemailer agar tidak crash jika tidak terinstall */
async function getNodemailer() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('nodemailer') as typeof import('nodemailer')
  } catch {
    return null
  }
}

async function createTransport(nodemailer: typeof import('nodemailer')) {
  // Mode OAuth2 (lebih aman, direkomendasikan)
  if (CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: SENDER_EMAIL,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
      },
      connectionTimeout: REQUEST_TIMEOUT_MS,
      socketTimeout: REQUEST_TIMEOUT_MS,
    })
  }

  // Mode App Password (Gmail SMTP + App Password)
  if (APP_PASSWORD) {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: SENDER_EMAIL,
        pass: APP_PASSWORD,
      },
      connectionTimeout: REQUEST_TIMEOUT_MS,
      socketTimeout: REQUEST_TIMEOUT_MS,
    })
  }

  return null
}

export async function sendEmailNotification(
  payload: NotificationPayload
): Promise<DeliveryResult> {
  if (!ENABLED) {
    return { channel: 'EMAIL', success: false, errorCode: 'CHANNEL_DISABLED' }
  }

  if (!SENDER_EMAIL) {
    console.warn('[Email] GMAIL_SENDER_EMAIL belum dikonfigurasi.')
    return { channel: 'EMAIL', success: false, errorCode: 'NOT_CONFIGURED' }
  }

  const to = payload.email?.trim()
  if (!to || !isValidEmail(to)) {
    return { channel: 'EMAIL', success: false, errorCode: 'INVALID_EMAIL' }
  }

  const nodemailer = await getNodemailer()
  if (!nodemailer) {
    console.warn('[Email] nodemailer tidak terinstall. Jalankan: npm install nodemailer')
    return { channel: 'EMAIL', success: false, errorCode: 'NODEMAILER_NOT_INSTALLED' }
  }

  const transport = await createTransport(nodemailer)
  if (!transport) {
    console.warn('[Email] Kredensial tidak lengkap. Konfigurasikan OAuth2 atau App Password.')
    return { channel: 'EMAIL', success: false, errorCode: 'NOT_CONFIGURED' }
  }

  const { subject, htmlBody, textBody } = buildEmailTemplate(payload, APP_BASE_URL)

  try {
    const info = await transport.sendMail({
      from: `"Sistem Pelayanan Desa" <${SENDER_EMAIL}>`,
      to,
      subject,
      html: htmlBody,
      text: textBody,
    })

    const messageId = info.messageId
    console.info(`[Email] Terkirim ke ${maskEmail(to)}, event: ${payload.eventType}`)
    return { channel: 'EMAIL', success: true, providerMessageId: messageId }
  } catch (err) {
    // Log error message aman, tanpa stack trace penuh atau kredensial
    const message = err instanceof Error ? err.message : 'unknown_error'
    // Hapus potensi leak token dari error message
    const safeMessage = message.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').slice(0, 100)
    console.error(`[Email] Gagal kirim ke ${maskEmail(to)}: ${safeMessage}`)

    let errorCode = 'SEND_FAILED'
    if (message.includes('ETIMEDOUT') || message.includes('timeout')) errorCode = 'TIMEOUT'
    else if (message.includes('invalid_grant')) errorCode = 'AUTH_FAILED'
    else if (message.includes('ECONNREFUSED')) errorCode = 'CONNECTION_REFUSED'

    return { channel: 'EMAIL', success: false, errorCode }
  } finally {
    transport.close?.()
  }
}
