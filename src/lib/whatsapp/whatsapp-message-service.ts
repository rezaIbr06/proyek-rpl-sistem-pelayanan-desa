import { getDecryptedWhatsAppCredentials, getWhatsAppConfig, updateWhatsAppConnectionStatus } from './whatsapp-config-service';
import { maskPhone, normalizePhoneForWhatsApp } from './crypto';
import { WhatsAppConnectionTestResult, WhatsAppMessagePayload, WhatsAppSendResult } from './types';

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Menguji koneksi kredensial ke Meta WhatsApp Business Cloud API.
 * Menggunakan endpoint resmi Graph API GET /{PHONE_NUMBER_ID}?fields=id,verified_name,display_phone_number,quality_rating
 */
export async function testMetaWhatsAppConnection(customCredentials?: {
  phoneNumberId?: string;
  accessToken?: string;
  apiVersion?: string;
}): Promise<WhatsAppConnectionTestResult> {
  const config = await getWhatsAppConfig();
  const creds = await getDecryptedWhatsAppCredentials();

  const phoneNumberId = customCredentials?.phoneNumberId?.trim() || config.phoneNumberId;
  const accessToken = customCredentials?.accessToken?.trim() || creds.accessToken;
  const apiVersion = customCredentials?.apiVersion?.trim() || config.apiVersion || 'v19.0';

  if (!phoneNumberId) {
    return {
      success: false,
      message: 'Phone Number ID belum diisi. Masukkan Phone Number ID dari Meta App Dashboard.'
    };
  }

  if (!accessToken) {
    return {
      success: false,
      message: 'Access Token belum diisi. Masukkan System User Access Token atau Permanent Token Meta.'
    };
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=id,verified_name,code_verification_status,display_phone_number,quality_rating`;
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      let errDetail = '';
      try {
        const errJson = await response.json();
        const errObj = errJson.error || errJson;
        errDetail = `[Kode: ${errObj.code || response.status}] ${errObj.message || response.statusText}`;
      } catch {
        errDetail = await response.text();
      }

      await updateWhatsAppConnectionStatus('FAILED', errDetail);

      return {
        success: false,
        message: `Koneksi ke Meta Cloud API gagal: ${errDetail}`,
        latencyMs,
        phoneNumberId
      };
    }

    const data = await response.json();
    const verifiedName = data.verified_name || 'Terverifikasi';
    const displayPhoneNumber = data.display_phone_number || '';
    const qualityRating = data.quality_rating || 'GREEN';

    await updateWhatsAppConnectionStatus('CONNECTED', null);

    return {
      success: true,
      message: `Koneksi berhasil! Terhubung ke WhatsApp Business "${verifiedName}" (${displayPhoneNumber || phoneNumberId})`,
      phoneNumberId: data.id,
      verifiedName,
      displayPhoneNumber,
      qualityRating,
      latencyMs
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const errMsg = isAbort
      ? `Batas waktu pengujian koneksi (${REQUEST_TIMEOUT_MS} ms) terlampaui. Periksa koneksi internet server.`
      : err instanceof Error ? err.message : String(err);

    await updateWhatsAppConnectionStatus('FAILED', errMsg);

    return {
      success: false,
      message: `Gagal menghubungi endpoint Meta Graph API: ${errMsg}`,
      latencyMs,
      phoneNumberId
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Mengirim pesan WhatsApp resmi via Meta Cloud API.
 * Mendukung template message resmi Meta (dengan component body parameters) maupun text message.
 */
export async function sendMetaWhatsAppMessage(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult> {
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

  const phoneNumberId = config.phoneNumberId;
  const accessToken = creds.accessToken;
  const apiVersion = config.apiVersion || 'v19.0';

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      errorCode: 'NOT_CONFIGURED',
      errorMessage: 'Kredensial WhatsApp Cloud API (Phone Number ID atau Access Token) belum lengkap.',
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

  // Siapkan body request ke Meta Graph API
  let requestBody: Record<string, unknown>;

  if (payload.parametersList && payload.parametersList.length > 0) {
    // Mode Template Message Resmi Meta
    requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedPhone,
      type: 'template',
      template: {
        name: payload.templateName,
        language: {
          code: payload.languageCode || 'id'
        },
        components: [
          {
            type: 'body',
            parameters: payload.parametersList.map(text => ({
              type: 'text',
              text: String(text || '-')
            }))
          }
        ]
      }
    };
  } else if (payload.textFallback) {
    // Mode Text Message
    requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: payload.textFallback
      }
    };
  } else {
    // Default template tanpa parameter
    requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedPhone,
      type: 'template',
      template: {
        name: payload.templateName,
        language: {
          code: payload.languageCode || 'id'
        }
      }
    };
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!response.ok) {
      const errJson = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const errObj = (errJson.error as Record<string, unknown>) || {};
      const errorCode = errObj.code ? `WA_ERR_${errObj.code}` : `HTTP_${response.status}`;
      const errorMessage = typeof errObj.message === 'string'
        ? errObj.message
        : typeof errObj.error_user_msg === 'string'
          ? errObj.error_user_msg
          : response.statusText;

      console.error(`[WhatsApp/Meta] Gagal kirim ke ${maskPhone(normalizedPhone)}: ${errorCode} - ${errorMessage}`);

      return {
        success: false,
        errorCode,
        errorMessage,
        recipientPhone: normalizedPhone,
        rawResponse: errJson
      };
    }

    const data = await response.json();
    const providerMessageId = data.messages?.[0]?.id || data.id;

    console.info(`[WhatsApp/Meta] Pesan terkirim ke ${maskPhone(normalizedPhone)}, messageId: ${providerMessageId}`);

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

    console.error(`[WhatsApp/Meta] Error kirim ke ${maskPhone(normalizedPhone)}: ${errorCode} - ${errorMessage}`);

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

