/**
 * API Admin: Riwayat pengiriman notifikasi eksternal
 *
 * GET /api/admin/notifications
 *
 * Hanya dapat diakses Admin.
 * Data dikembalikan tanpa token, client secret, atau refresh token.
 * Recipient sudah disamarkan (masked).
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { getDeliveryHistory } from '@/lib/notifications/notification-service'

export async function GET(req: NextRequest) {
  // Autentikasi: hanya Admin
  const session = await verifySession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit = Math.min(Math.max(parseInt(limitParam ?? '50', 10) || 50, 1), 200)

  const deliveries = await getDeliveryHistory(limit)

  // Status konfigurasi (tanpa nilai rahasia)
  const config = {
    whatsapp: {
      enabled: process.env.WHATSAPP_ENABLED === 'true',
      configured: !!(
        process.env.FONNTE_TOKEN ||
        (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
      ),
      provider: process.env.FONNTE_TOKEN ? 'Fonnte Gateway' : 'Meta WhatsApp Cloud API',
    },
    email: {
      enabled: process.env.GMAIL_ENABLED === 'true',
      configured: !!(process.env.GMAIL_SENDER_EMAIL && (
        (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN) ||
        process.env.GMAIL_APP_PASSWORD
      )),
      senderEmail: process.env.GMAIL_SENDER_EMAIL
        ? maskEmail(process.env.GMAIL_SENDER_EMAIL)
        : null,
    },
  }

  return NextResponse.json({ config, deliveries })
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '****'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}***@${domain}`
}
