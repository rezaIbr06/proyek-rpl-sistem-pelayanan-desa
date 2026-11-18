/**
 * WhatsApp Business Cloud API Webhook Handler
 *
 * GET  - Verifikasi Webhook Meta (challenge response)
 * POST - Menerima update status pesan (sent, delivered, read, failed)
 *
 * KEAMANAN:
 * - GET: Mencocokkan hub.verify_token dengan Webhook Verify Token dari database/env.
 * - POST: Wajib memvalidasi X-Hub-Signature-256 menggunakan App Secret (timing-safe comparison).
 * - Tidak mencatat data pribadi sensitif dalam log.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  handleWebhookChallenge,
  verifyWebhookSignature,
  processWebhookStatusUpdates
} from '@/lib/whatsapp/whatsapp-webhook-service';

// GET: Verifikasi webhook oleh Meta saat konfigurasi webhook di Meta App Dashboard
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('hub.mode');
  const verifyToken = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const result = await handleWebhookChallenge({
    mode,
    verifyToken,
    challenge
  });

  if (result.success && result.challenge) {
    return new NextResponse(result.challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  return NextResponse.json({ error: result.error || 'Verifikasi webhook gagal' }, { status: 403 });
}

// POST: Menerima status pengiriman dari Meta Cloud API (sent, delivered, read, failed)
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  // Validasi signature jika signature disediakan atau app secret aktif
  const isSignatureValid = await verifyWebhookSignature(rawBody, signature);
  if (!isSignatureValid) {
    console.warn('[WhatsApp Webhook] Signature verification failed or missing.');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);

    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' });
    }

    const { processedCount } = await processWebhookStatusUpdates(payload);

    console.info(`[WhatsApp Webhook] Berhasil memproses ${processedCount} status update.`);
    return NextResponse.json({ status: 'ok', processed: processedCount });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[WhatsApp Webhook] Error parsing webhook payload:', errMsg);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
