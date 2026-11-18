/**
 * Template pesan WhatsApp dan email HTML/teks untuk sistem notifikasi.
 *
 * CATATAN WhatsApp:
 * - Template Message harus sudah disetujui di Meta Business Manager.
 * - Nama template (templateName) HARUS sesuai dengan yang disetujui.
 * - Parameter body berurut sesuai placeholder {{1}}, {{2}}, dst.
 * - Di luar 24-jam jendela layanan, hanya template yang disetujui yang boleh dikirim.
 */

import type { NotificationEventType, NotificationPayload } from './types'

export interface WhatsAppTemplateParams {
  templateName: string
  languageCode: string
  /** Parameter body berurut sesuai placeholder {{1}}, {{2}}, dst */
  bodyParams: string[]
}

export interface EmailTemplateResult {
  subject: string
  htmlBody: string
  textBody: string
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Diajukan',
  VERIFIED: 'Diverifikasi',
  PROCESSING: 'Sedang Diproses',
  REVISION_REQUIRED: 'Perlu Perbaikan',
  COMPLETED: 'Selesai',
  REJECTED: 'Ditolak',
  APPROVED: 'Disetujui',
}

const WA_TEMPLATE_NAMES: Record<NotificationEventType, string> = {
  SUBMITTED: 'permohonan_diajukan',
  PROCESSING: 'permohonan_diproses',
  REVISION_REQUIRED: 'permohonan_perlu_perbaikan',
  APPROVED: 'permohonan_disetujui',
  REJECTED: 'permohonan_ditolak',
  COMPLETED: 'permohonan_selesai',
}

export function buildWhatsAppTemplate(payload: NotificationPayload): WhatsAppTemplateParams {
  const { eventType, citizenName, applicationNum, serviceName, status, publicNotes } = payload
  const statusLabel = STATUS_LABELS[status] ?? status
  const templateName = WA_TEMPLATE_NAMES[eventType]

  switch (eventType) {
    case 'SUBMITTED':
      return { templateName, languageCode: 'id', bodyParams: [citizenName, serviceName, applicationNum, statusLabel] }
    case 'PROCESSING':
      return { templateName, languageCode: 'id', bodyParams: [citizenName, applicationNum, serviceName] }
    case 'REVISION_REQUIRED':
      return { templateName, languageCode: 'id', bodyParams: [citizenName, applicationNum, publicNotes ?? 'Lihat detail di aplikasi'] }
    case 'APPROVED':
      return { templateName, languageCode: 'id', bodyParams: [citizenName, applicationNum, serviceName] }
    case 'REJECTED':
      return { templateName, languageCode: 'id', bodyParams: [citizenName, applicationNum, publicNotes ?? '-'] }
    case 'COMPLETED':
      return { templateName, languageCode: 'id', bodyParams: [citizenName, applicationNum] }
    default: {
      const _exhaustive: never = eventType
      throw new Error(`Unknown event type: ${String(_exhaustive)}`)
    }
  }
}

/**
 * Format teks pesan WhatsApp lengkap (digunakan oleh gateway WhatsApp seperti Fonnte).
 */
export function buildWhatsAppTextMessage(payload: NotificationPayload): string {
  const { eventType, citizenName, applicationNum, serviceName, status, publicNotes } = payload
  const statusLabel = STATUS_LABELS[status] ?? status

  switch (eventType) {
    case 'SUBMITTED':
      return `Yth. *${citizenName}*,\n\nPermohonan *${serviceName}* dengan nomor *${applicationNum}* berhasil diajukan.\nStatus: *${statusLabel}*.\n\nSilakan pantau perkembangan permohonan Anda melalui Sistem Pelayanan Desa.`
    case 'PROCESSING':
      return `Yth. *${citizenName}*,\n\nPermohonan *${serviceName}* dengan nomor *${applicationNum}* saat ini sedang diproses oleh petugas kami.\n\nSilakan pantau perkembangan melalui Sistem Pelayanan Desa.`
    case 'REVISION_REQUIRED':
      return `Yth. *${citizenName}*,\n\nPermohonan *${applicationNum}* memerlukan perbaikan dokumen.${publicNotes ? `\n\nCatatan Petugas: *${publicNotes}*` : ''}\n\nSilakan masuk ke Sistem Pelayanan Desa untuk melakukan perbaikan dokumen.`
    case 'APPROVED':
      return `Yth. *${citizenName}*,\n\nPermohonan *${applicationNum}* untuk *${serviceName}* telah disetujui.\n\nSilakan masuk ke Sistem Pelayanan Desa untuk melihat informasi selanjutnya.`
    case 'REJECTED':
      return `Yth. *${citizenName}*,\n\nPermohonan *${applicationNum}* untuk *${serviceName}* tidak dapat diproses.${publicNotes ? `\n\nAlasan: *${publicNotes}*` : ''}\n\nSilakan masuk ke Sistem Pelayanan Desa untuk melihat informasi selanjutnya.`
    case 'COMPLETED':
      return `Yth. *${citizenName}*,\n\nProses pelayanan untuk permohonan *${applicationNum}* telah selesai. Dokumen/surat sudah siap diambil.\n\nSilakan periksa informasi selanjutnya melalui Sistem Pelayanan Desa.`
    default:
      return `Yth. *${citizenName}*,\n\nStatus permohonan *${applicationNum}* telah diperbarui menjadi *${statusLabel}*.\n\nSilakan periksa melalui Sistem Pelayanan Desa.`
  }
}

const EMAIL_SUBJECTS: Record<NotificationEventType, string> = {
  SUBMITTED: 'Permohonan Berhasil Diajukan',
  PROCESSING: 'Permohonan Anda Sedang Diproses',
  REVISION_REQUIRED: 'Permohonan Memerlukan Perbaikan Dokumen',
  APPROVED: 'Permohonan Anda Telah Disetujui',
  REJECTED: 'Informasi Mengenai Permohonan Anda',
  COMPLETED: 'Permohonan Anda Telah Selesai',
}

export function buildEmailTemplate(
  payload: NotificationPayload,
  appBaseUrl: string
): EmailTemplateResult {
  const { eventType, citizenName, applicationNum, applicationId, serviceName, status, publicNotes } = payload
  const changedAt = payload.changedAt ?? new Date()
  const subject = EMAIL_SUBJECTS[eventType]
  const statusLabel = STATUS_LABELS[status] ?? status
  const detailUrl = `${appBaseUrl}/dashboard/warga/permohonan/${applicationId}`

  const formattedDate = changedAt.toLocaleString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  })

  const eventMessages: Record<NotificationEventType, string> = {
    SUBMITTED: 'Permohonan Anda telah berhasil diajukan dan sedang menunggu verifikasi dari petugas.',
    PROCESSING: 'Permohonan Anda sedang dalam tahap pemrosesan oleh petugas kami.',
    REVISION_REQUIRED: 'Permohonan Anda memerlukan perbaikan dokumen. Silakan masuk ke sistem untuk melihat detail dan mengunggah dokumen yang diperlukan.',
    APPROVED: 'Selamat! Permohonan Anda telah disetujui. Silakan masuk ke sistem untuk informasi selanjutnya.',
    REJECTED: 'Mohon maaf, permohonan Anda tidak dapat kami proses. Silakan masuk ke sistem untuk melihat alasan penolakan.',
    COMPLETED: 'Permohonan Anda telah selesai diproses. Silakan masuk ke sistem untuk informasi selanjutnya.',
  }

  const mainMessage = eventMessages[eventType]
  const escapeHtml = (t: string) => t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

  const notesHtml = publicNotes
    ? `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong style="color:#374151;">Catatan Petugas:</strong><br/><span style="color:#6b7280;font-style:italic;">${escapeHtml(publicNotes)}</span></td></tr>`
    : ''
  const notesText = publicNotes ? `\nCatatan Petugas: ${publicNotes}` : ''

  const htmlBody = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
<tr><td style="background:linear-gradient(135deg,#991b1b,#dc2626);padding:32px 40px;text-align:center;">
  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Sistem Pelayanan Desa</h1>
  <p style="margin:8px 0 0;color:#fecaca;font-size:14px;">Notifikasi Status Permohonan</p>
</td></tr>
<tr><td style="padding:32px 40px;">
  <p style="margin:0 0 16px;color:#374151;font-size:16px;">Yth. <strong>${escapeHtml(citizenName)}</strong>,</p>
  <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">${escapeHtml(mainMessage)}</p>
  <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr><td style="background-color:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;padding:12px 16px;">
      <span style="font-size:13px;color:#6b7280;display:block;margin-bottom:4px;">Status Terkini</span>
      <strong style="font-size:18px;color:#991b1b;">${escapeHtml(statusLabel)}</strong>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
    <tr><td style="padding:16px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
          <strong style="color:#374151;">Nomor Permohonan:</strong><br/>
          <span style="color:#991b1b;font-family:monospace;font-weight:600;">${escapeHtml(applicationNum)}</span>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
          <strong style="color:#374151;">Nama Layanan:</strong><br/>
          <span style="color:#6b7280;">${escapeHtml(serviceName)}</span>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
          <strong style="color:#374151;">Waktu Perubahan:</strong><br/>
          <span style="color:#6b7280;">${escapeHtml(formattedDate)} WIB</span>
        </td></tr>
        ${notesHtml}
      </table>
    </td></tr>
  </table>
  <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
    <tr><td style="border-radius:8px;background-color:#dc2626;text-align:center;">
      <a href="${detailUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
        Lihat Detail Permohonan
      </a>
    </td></tr>
  </table>
  <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Tautan di atas memerlukan login ke akun Anda.</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0;font-size:12px;color:#9ca3af;">
    Email ini dikirim otomatis oleh Sistem Pelayanan Desa.<br/>
    Jangan membalas email ini. Hubungi kantor desa untuk pertanyaan lebih lanjut.
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const textBody = `Yth. ${citizenName},

${mainMessage}

DETAIL PERMOHONAN
-----------------
Nomor Permohonan : ${applicationNum}
Nama Layanan     : ${serviceName}
Status Terkini   : ${statusLabel}
Waktu Perubahan  : ${formattedDate} WIB${notesText}

Untuk melihat detail, silakan login ke:
${detailUrl}
(Tautan memerlukan login)

---
Email ini dikirim otomatis oleh Sistem Pelayanan Desa.`

  return { subject, htmlBody, textBody }
}
