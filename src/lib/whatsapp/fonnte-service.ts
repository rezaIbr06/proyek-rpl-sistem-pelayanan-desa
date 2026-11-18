import { getDecryptedWhatsAppCredentials, getWhatsAppConfig, updateWhatsAppConnectionStatus } from './whatsapp-config-service';
import { maskPhone, normalizePhoneForWhatsApp } from './crypto';
import { WhatsAppConnectionTestResult, WhatsAppSendResult } from './types';

const REQUEST_TIMEOUT_MS = 15_000;

interface FonnteDeviceResponse {
  status?: boolean;
  name?: string;
  device?: string;
  device_status?: string;
  expired?: string;
  messages?: number;
  quota?: number | string;
  reason?: string;
}

interface FonnteSendResponse {
  status?: boolean;
  id?: string[] | string | number;
  process?: string;
  target?: string[];
  reason?: string;
}

/**
 * Menguji koneksi dan status device pada Fonnte WhatsApp Gateway.
 * Endpoint: POST https://api.fonnte.com/device
 */
export async function testFonnteConnection(customToken?: string): Promise<WhatsAppConnectionTestResult> {
  const creds = await getDecryptedWhatsAppCredentials();
  const token = customToken?.trim() || creds.fonnteToken;

  if (!token) {
    return {
      success: false,
      provider: 'FONNTE',
      message: 'Fonnte API Token belum diisi. Masukkan API Token dari dashboard Fonnte.'
    };
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.fonnte.com/device', {
      method: 'POST',
      headers: {
        'Authorization': token
      },
      signal: controller.signal
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      const errMsg = `HTTP ${response.status}: ${errText || response.statusText}`;
      await updateWhatsAppConnectionStatus('FAILED', errMsg);
      return {
        success: false,
        provider: 'FONNTE',
        message: `Koneksi ke server Fonnte gagal (${errMsg}).`,
        latencyMs
      };
    }

    const data = (await response.json().catch(() => ({}))) as FonnteDeviceResponse;

    if (data.status === false) {
      const reason = data.reason || 'Token Fonnte tidak valid atau akun dinonaktifkan.';
      await updateWhatsAppConnectionStatus('FAILED', reason);
      return {
        success: false,
        provider: 'FONNTE',
        message: `Autentikasi Fonnte gagal: ${reason}`,
        latencyMs
      };
    }

    const deviceName = data.name || 'Device Fonnte';
    const displayPhone = data.device || '-';
    const deviceStatus = (data.device_status || '').toLowerCase();
    const quota = data.quota !== undefined ? data.quota : (data.messages !== undefined ? data.messages : '-');

    if (deviceStatus === 'connect' || deviceStatus === 'connected') {
      await updateWhatsAppConnectionStatus('CONNECTED', null);
      return {
        success: true,
        provider: 'FONNTE',
        message: `Koneksi Fonnte Berhasil! Device: "${deviceName}" (${displayPhone}) | Status: TERHUBUNG | Sisa Kuota: ${quota}`,
        verifiedName: deviceName,
        displayPhoneNumber: displayPhone,
        deviceStatus: 'CONNECTED',
        deviceName,
        quota,
        latencyMs
      };
    } else {
      const warnMsg = `Device Fonnte terdaftar ("${deviceName}", ${displayPhone}), tetapi statusnya '${deviceStatus || 'disconnect'}'. Silakan scan QR code WhatsApp di dashboard Fonnte.`;
      await updateWhatsAppConnectionStatus('FAILED', warnMsg);
      return {
        success: false,
        provider: 'FONNTE',
        message: warnMsg,
        verifiedName: deviceName,
        displayPhoneNumber: displayPhone,
        deviceStatus: deviceStatus.toUpperCase() || 'DISCONNECTED',
        deviceName,
        quota,
        latencyMs
      };
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const errMsg = isAbort
      ? `Batas waktu pengujian koneksi (${REQUEST_TIMEOUT_MS} ms) terlampaui.`
      : err instanceof Error ? err.message : String(err);

    await updateWhatsAppConnectionStatus('FAILED', errMsg);

    return {
      success: false,
      provider: 'FONNTE',
      message: `Gagal menghubungi endpoint Fonnte: ${errMsg}`,
      latencyMs
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Mengirim pesan WhatsApp teks melalui Fonnte Gateway.
 * Endpoint: POST https://api.fonnte.com/send
 */
export async function sendFonnteMessage(payload: {
  to: string;
  message: string;
  countryCode?: string;
}, customToken?: string): Promise<WhatsAppSendResult> {
  const config = await getWhatsAppConfig();
  const creds = await getDecryptedWhatsAppCredentials();

  if (!config.isEnabled) {
    return {
      success: false,
      errorCode: 'CHANNEL_DISABLED',
      errorMessage: 'Saluran notifikasi WhatsApp sedang dinonaktifkan di pengaturan sistem.',
      recipientPhone: maskPhone(payload.to)
    };
  }

  const token = customToken?.trim() || creds.fonnteToken;
  if (!token) {
    return {
      success: false,
      errorCode: 'NOT_CONFIGURED',
      errorMessage: 'Token Fonnte belum dikonfigurasi di dashboard atau environment variable.',
      recipientPhone: maskPhone(payload.to)
    };
  }

  const normalizedPhone = normalizePhoneForWhatsApp(payload.to);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    return {
      success: false,
      errorCode: 'INVALID_PHONE',
      errorMessage: `Nomor telepon tujuan tidak valid (${payload.to}).`,
      recipientPhone: maskPhone(payload.to)
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({
        target: normalizedPhone,
        message: payload.message,
        countryCode: payload.countryCode || '62'
      }),
      signal: controller.signal
    });

    const data = (await response.json().catch(() => ({}))) as FonnteSendResponse;

    if (!response.ok || data.status === false) {
      const reason = data.reason
        ? `FONNTE_${data.reason.toUpperCase().replace(/\s+/g, '_')}`
        : `HTTP_${response.status}`;
      const errorMessage = data.reason || response.statusText || 'Gagal mengirim via Fonnte';

      console.error(`[WhatsApp/Fonnte] Gagal kirim ke ${maskPhone(normalizedPhone)}: ${reason} - ${errorMessage}`);

      return {
        success: false,
        errorCode: reason,
        errorMessage,
        recipientPhone: normalizedPhone,
        rawResponse: data
      };
    }

    const rawId = Array.isArray(data.id) && data.id.length > 0
      ? String(data.id[0])
      : (data.id !== undefined && data.id !== null ? String(data.id) : undefined);

    const providerMessageId = rawId ? `fonnte_${rawId}` : `fonnte_${Date.now()}`;

    console.info(`[WhatsApp/Fonnte] Pesan terkirim ke ${maskPhone(normalizedPhone)}, messageId: ${providerMessageId}`);

    return {
      success: true,
      providerMessageId,
      recipientPhone: normalizedPhone,
      rawResponse: data
    };
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const errorCode = isAbort ? 'TIMEOUT' : 'NETWORK_ERROR';
    const errorMessage = isAbort
      ? `Batas waktu pengiriman (${REQUEST_TIMEOUT_MS} ms) terlampaui.`
      : err instanceof Error ? err.message : String(err);

    console.error(`[WhatsApp/Fonnte] Error kirim ke ${maskPhone(normalizedPhone)}: ${errorCode} - ${errorMessage}`);

    return {
      success: false,
      errorCode,
      errorMessage,
      recipientPhone: normalizedPhone
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

