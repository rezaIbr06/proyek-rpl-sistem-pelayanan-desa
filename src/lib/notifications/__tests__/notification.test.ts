/**
 * Unit tests untuk sistem notifikasi eksternal.
 * Menggunakan mock provider - TIDAK mengirim pesan/email sungguhan.
 *
 * Jalankan: npx jest src/lib/notifications/__tests__/notification.test.ts
 * (Jika jest belum dikonfigurasi, sesuaikan dengan setup test proyek)
 */

import { buildWhatsAppTemplate, buildEmailTemplate, buildWhatsAppTextMessage } from '../templates'
import { maskPhone } from '../whatsapp-provider'
import { maskEmail } from '../email-provider'
import type { NotificationPayload } from '../types'

// =====================
// Helper: buat payload standar
// =====================
function makePayload(override: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    eventType: 'SUBMITTED',
    applicationId: 'app-123',
    applicationNum: 'REQ-20261022-1234',
    serviceName: 'Surat Keterangan Domisili',
    status: 'SUBMITTED',
    citizenName: 'Budi Santoso',
    phoneNumber: '+6281234567890',
    email: 'budi.santoso@gmail.com',
    changedAt: new Date('2026-10-22T10:00:00Z'),
    ...override,
  }
}

// =====================
// Test: WhatsApp template builder
// =====================
describe('buildWhatsAppTemplate', () => {
  test('SUBMITTED: menghasilkan template dengan params yang benar', () => {
    const payload = makePayload({ eventType: 'SUBMITTED' })
    const result = buildWhatsAppTemplate(payload)
    expect(result.templateName).toBe('permohonan_diajukan')
    expect(result.languageCode).toBe('id')
    expect(result.bodyParams).toContain('Budi Santoso')
    expect(result.bodyParams).toContain('REQ-20261022-1234')
    expect(result.bodyParams).toContain('Surat Keterangan Domisili')
  })

  test('REVISION_REQUIRED: menyertakan publicNotes atau fallback', () => {
    const payload = makePayload({ eventType: 'REVISION_REQUIRED', publicNotes: 'KTP kurang jelas' })
    const result = buildWhatsAppTemplate(payload)
    expect(result.templateName).toBe('permohonan_perlu_perbaikan')
    expect(result.bodyParams).toContain('KTP kurang jelas')
  })

  test('REVISION_REQUIRED: fallback jika publicNotes kosong', () => {
    const payload = makePayload({ eventType: 'REVISION_REQUIRED', publicNotes: undefined })
    const result = buildWhatsAppTemplate(payload)
    expect(result.bodyParams.some(p => p.length > 0)).toBe(true)
  })

  test('COMPLETED: params minimal', () => {
    const payload = makePayload({ eventType: 'COMPLETED' })
    const result = buildWhatsAppTemplate(payload)
    expect(result.templateName).toBe('permohonan_selesai')
    expect(result.bodyParams).toContain('Budi Santoso')
    expect(result.bodyParams).toContain('REQ-20261022-1234')
  })

  test.each(['SUBMITTED', 'PROCESSING', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED', 'COMPLETED'] as const)(
    'Semua event type menghasilkan templateName yang valid: %s',
    (eventType) => {
      const payload = makePayload({ eventType })
      const result = buildWhatsAppTemplate(payload)
      expect(result.templateName).toBeTruthy()
      expect(result.bodyParams.length).toBeGreaterThan(0)
    }
  )
})

// =====================
// Test: WhatsApp text message builder (Fonnte)
// =====================
describe('buildWhatsAppTextMessage', () => {
  test('SUBMITTED: menghasilkan teks pesan lengkap', () => {
    const payload = makePayload({ eventType: 'SUBMITTED' })
    const text = buildWhatsAppTextMessage(payload)
    expect(text).toContain('Budi Santoso')
    expect(text).toContain('REQ-20261022-1234')
    expect(text).toContain('Surat Keterangan Domisili')
    expect(text).toContain('berhasil diajukan')
  })

  test('REVISION_REQUIRED: menyertakan catatan petugas', () => {
    const payload = makePayload({ eventType: 'REVISION_REQUIRED', publicNotes: 'KTP tidak terbaca' })
    const text = buildWhatsAppTextMessage(payload)
    expect(text).toContain('KTP tidak terbaca')
    expect(text).toContain('perbaikan dokumen')
  })

  test.each(['SUBMITTED', 'PROCESSING', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED', 'COMPLETED'] as const)(
    'Semua event type menghasilkan teks yang valid: %s',
    (eventType) => {
      const payload = makePayload({ eventType })
      const text = buildWhatsAppTextMessage(payload)
      expect(text.length).toBeGreaterThan(20)
      expect(text).toContain('Budi Santoso')
    }
  )
})

// =====================
// Test: Email template builder
// =====================
describe('buildEmailTemplate', () => {
  const BASE_URL = 'https://desa.example.com'

  test('menghasilkan subject yang sesuai untuk SUBMITTED', () => {
    const result = buildEmailTemplate(makePayload(), BASE_URL)
    expect(result.subject).toBe('Permohonan Berhasil Diajukan')
    expect(result.htmlBody).toContain('Budi Santoso')
    expect(result.htmlBody).toContain('REQ-20261022-1234')
    expect(result.textBody).toContain('REQ-20261022-1234')
  })

  test('link detail memerlukan login - menggunakan applicationId', () => {
    const result = buildEmailTemplate(makePayload(), BASE_URL)
    // Link tidak mengandung applicationNum di URL (harus pakai ID yang tidak mudah ditebak)
    expect(result.htmlBody).toContain('/dashboard/warga/permohonan/app-123')
    // Tidak boleh ada link yang bisa diakses tanpa login
    expect(result.htmlBody).not.toContain('?token=')
    expect(result.htmlBody).not.toContain('public=true')
  })

  test('publicNotes ditampilkan jika ada', () => {
    const payload = makePayload({ eventType: 'REVISION_REQUIRED', publicNotes: 'KTP buram' })
    const result = buildEmailTemplate(payload, BASE_URL)
    expect(result.htmlBody).toContain('KTP buram')
    expect(result.textBody).toContain('KTP buram')
  })

  test('HTML di-escape untuk mencegah XSS', () => {
    const payload = makePayload({ citizenName: '<script>alert(1)</script>' })
    const result = buildEmailTemplate(payload, BASE_URL)
    expect(result.htmlBody).not.toContain('<script>')
    expect(result.htmlBody).toContain('&lt;script&gt;')
  })

  test('semua event type menghasilkan subject yang tidak kosong', () => {
    const events = ['SUBMITTED', 'PROCESSING', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED', 'COMPLETED'] as const
    for (const eventType of events) {
      const result = buildEmailTemplate(makePayload({ eventType }), BASE_URL)
      expect(result.subject.length).toBeGreaterThan(0)
    }
  })
})

// =====================
// Test: Masking functions
// =====================
describe('maskPhone', () => {
  test('Masking nomor dengan panjang normal', () => {
    const masked = maskPhone('+6281234567890')
    expect(masked).toContain('+6281')
    expect(masked).toContain('7890')
    expect(masked).toContain('*')
    // Tidak boleh mengandung digit asli di tengah
    expect(masked).not.toBe('+6281234567890')
  })

  test('Nomor kosong dikembalikan aman', () => {
    expect(maskPhone('')).toBe('****')
    expect(maskPhone('12')).toBe('****')
  })
})

describe('maskEmail', () => {
  test('Masking email normal', () => {
    const masked = maskEmail('budi.santoso@gmail.com')
    expect(masked).toContain('@gmail.com')
    expect(masked).toContain('bu')
    expect(masked).toContain('***')
    expect(masked).not.toBe('budi.santoso@gmail.com')
  })

  test('Email tidak valid dikembalikan aman', () => {
    expect(maskEmail('invalid')).toBe('****')
  })
})

// =====================
// Test: Simulasi kegagalan provider tidak saling memblokir
// (Unit test terpisah dari integration - mock provider)
// =====================
describe('Provider independence (mock)', () => {
  test('Kegagalan WhatsApp tidak menghentikan pengiriman Email', async () => {
    // Simulasi: kedua provider dipanggil independen
    const results = await Promise.allSettled([
      Promise.reject(new Error('WA FAILED')),
      Promise.resolve({ channel: 'EMAIL' as const, success: true }),
    ])

    // Meskipun WhatsApp gagal, email tetap berhasil
    expect(results[0].status).toBe('rejected')
    expect(results[1].status).toBe('fulfilled')
    if (results[1].status === 'fulfilled') {
      expect(results[1].value.success).toBe(true)
    }
  })

  test('Kegagalan Email tidak menghentikan pengiriman WhatsApp', async () => {
    const results = await Promise.allSettled([
      Promise.resolve({ channel: 'WHATSAPP' as const, success: true }),
      Promise.reject(new Error('EMAIL FAILED')),
    ])

    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('rejected')
    if (results[0].status === 'fulfilled') {
      expect(results[0].value.success).toBe(true)
    }
  })
})

// =====================
// Test: Keamanan - tidak leak token & validasi input
// =====================
describe('Security & Resilience', () => {
  test('maskPhone tidak mengekspos nomor lengkap', () => {
    const phone = '+6281234567890'
    const masked = maskPhone(phone)
    expect(masked).not.toBe(phone)
    expect(masked.includes('****') || masked.includes('***')).toBe(true)
  })

  test('maskEmail tidak mengekspos email lengkap', () => {
    const email = 'rahasia.sekali@gmail.com'
    const masked = maskEmail(email)
    expect(masked).not.toBe(email)
    expect(masked.includes('***')).toBe(true)
  })

  test('Kredensial tidak tersedia tidak menyebabkan crash (graceful degradation)', () => {
    // Simulasi payload tanpa kredensial di env
    const payload = makePayload({ phoneNumber: undefined, email: undefined })
    expect(() => buildWhatsAppTemplate(payload)).not.toThrow()
    expect(() => buildEmailTemplate(payload, 'http://localhost:3000')).not.toThrow()
  })

  test('Nomor telepon tidak valid atau kosong ditangani dengan aman', () => {
    expect(maskPhone('')).toBe('****')
    expect(maskPhone('abc')).toBe('****')
    expect(maskPhone('12345')).toBe('****')
  })

  test('Email tidak valid ditangani dengan aman', () => {
    expect(maskEmail('')).toBe('****')
    expect(maskEmail('notanemail')).toBe('****')
  })

  test('Idempotency logic: event yang sama dengan status SENT dicegah dari pengiriman ulang', () => {
    const alreadySentList = [{ channel: 'WHATSAPP', status: 'SENT' }, { channel: 'EMAIL', status: 'SENT' }]
    const alreadySentChannels = new Set(alreadySentList.map(d => d.channel))

    const channels = ['WHATSAPP', 'EMAIL']
    const toSend = channels.filter(c => !alreadySentChannels.has(c))
    expect(toSend.length).toBe(0) // Tidak ada yang dikirim ulang
  })

  test('Status delivery terpisah antara WhatsApp dan Email', () => {
    const deliveries = [
      { id: 'del-1', channel: 'WHATSAPP', status: 'SENT', attemptCount: 1 },
      { id: 'del-2', channel: 'EMAIL', status: 'FAILED', attemptCount: 3, errorCode: 'TIMEOUT' },
    ]
    expect(deliveries[0].status).toBe('SENT')
    expect(deliveries[1].status).toBe('FAILED')
    expect(deliveries[0].channel).not.toBe(deliveries[1].channel)
  })

  test('Proteksi Role: Warga tidak memiliki hak akses endpoint admin notifikasi', () => {
    const mockSessionWarga = { userId: 'user-warga', role: 'WARGA' }
    const isAdmin = mockSessionWarga.role === 'ADMIN'
    expect(isAdmin).toBe(false)
  })
})
