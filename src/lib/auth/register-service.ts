import { z } from 'zod'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendEmailNotification } from '@/lib/notifications/email-provider'

/**
 * Skema validasi pendaftaran akun warga
 */
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama lengkap wajib diisi')
    .min(2, 'Nama lengkap minimal 2 karakter')
    .max(100, 'Nama lengkap maksimal 100 karakter'),
  email: z
    .string()
    .trim()
    .min(1, 'Email wajib diisi')
    .email('Format email tidak valid')
    .max(100, 'Email maksimal 100 karakter')
    .transform((val) => val.toLowerCase()),
  nomorTelepon: z
    .string()
    .trim()
    .min(1, 'Nomor telepon/WhatsApp wajib diisi')
    .regex(
      /^(\+62|62|0)8[1-9][0-9]{6,11}$/,
      'Nomor telepon harus nomor Indonesia valid (contoh: 08123456789 atau +628123456789)'
    ),
  alamat: z
    .string()
    .trim()
    .min(1, 'Alamat tempat tinggal wajib diisi')
    .min(5, 'Alamat tempat tinggal minimal 5 karakter')
    .max(300, 'Alamat maksimal 300 karakter'),
  password: z
    .string()
    .min(1, 'Password wajib diisi')
    .min(8, 'Password minimal 8 karakter')
    .max(72, 'Password maksimal 72 karakter')
    .regex(/[A-Za-z]/, 'Password harus mengandung setidaknya satu huruf')
    .regex(/[0-9]/, 'Password harus mengandung setidaknya satu angka'),
  confirmPassword: z
    .string()
    .min(1, 'Konfirmasi password wajib diisi'),
  agreeTerms: z
    .boolean()
    .refine((val) => val === true, {
      message: 'Anda harus menyetujui ketentuan layanan dan kebijakan privasi penggunaan data',
    }),
  // role dari client akan selalu diabaikan di sisi server
  role: z.any().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Konfirmasi password tidak cocok dengan password',
  path: ['confirmPassword'],
})

export type RegisterInput = z.infer<typeof registerSchema>

export interface RegisterResult {
  success: boolean
  message?: string
  error?: string
  code?: string
  user?: {
    id: string
    name: string
    email: string
    role: string
    status: string
    createdAt: Date
  }
  emailVerification?: {
    required: boolean
    sent: boolean
    message?: string
  }
}

/**
 * Fungsi core pendaftaran warga:
 * - Menjalankan validasi input
 * - Menolak duplikasi email secara aman
 * - Menghash password dengan bcrypt
 * - Memaksa role CITIZEN di server (mengabaikan request apapun yang mencoba role ADMIN/STAFF/SUPERVISOR)
 * - Menyimpan User + CitizenProfile + VerificationToken dalam satu transaksi database
 * - Mengembalikan data aman tanpa pernah membocorkan password atau hash
 */
export async function registerCitizen(rawInput: unknown): Promise<RegisterResult> {
  // 1. Validasi Input di Server
  const parseResult = registerSchema.safeParse(rawInput)
  if (!parseResult.success) {
    const firstError = 
      parseResult.error.issues?.[0]?.message || 
      (parseResult.error as unknown as { errors?: Array<{ message: string }> }).errors?.[0]?.message || 
      'Input formulir tidak valid'
    return {
      success: false,
      error: firstError,
      code: 'VALIDATION_ERROR',
    }
  }

  const { name, email, nomorTelepon, alamat, password } = parseResult.data

  try {
    // 2. Cek apakah email sudah terdaftar
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existing) {
      return {
        success: false,
        error: 'Email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.',
        code: 'EMAIL_ALREADY_EXISTS',
      }
    }

    // 3. Hash Password dengan Bcrypt (cost factor 10)
    const passwordHash = await bcrypt.hash(password, 10)

    // 4. Buat Token Verifikasi Email acak kriptografis (32 bytes hex)
    const rawVerificationToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex')
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // Berlaku 24 jam

    // 5. Eksekusi Transaksi Database (Atomic)
    const newUser = await prisma.$transaction(async (tx) => {
      // Buat akun User dengan role terenkapsulasi di server: CITIZEN
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: 'CITIZEN', // STRICT SERVER-ENFORCED ROLE
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      })

      // Buat data CitizenProfile dengan alamat dan nomor telepon yang diisi saat registrasi
      await tx.citizenProfile.create({
        data: {
          userId: user.id,
          nomorTelepon,
          alamat,
          nik: null,
          nomorKk: null,
        },
      })

      // Buat data UserProfile (tabel user_profiles)
      await tx.userProfile.create({
        data: {
          userId: user.id,
          birthPlace: null,
          birthDate: null,
          gender: null,
          areaId: null,
          additionalAddress: alamat,
        },
      })

      // Simpan persetujuan ketentuan layanan & kebijakan privasi (tabel user_consents)
      await tx.userConsent.createMany({
        data: [
          { userId: user.id, consentType: 'TERMS_OF_SERVICE', consentVersion: 'v1.0' },
          { userId: user.id, consentType: 'PRIVACY_POLICY', consentVersion: 'v1.0' },
        ],
      })

      // Simpan hash token verifikasi email (tabel email_verification_tokens)
      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: tokenExpiresAt,
          usedAt: null,
        },
      })

      // Catat log audit pendaftaran
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'REGISTER_CITIZEN',
          entityType: 'User',
          entityId: user.id,
          details: JSON.stringify({ email, role: 'CITIZEN' }),
        },
      })

      return user
    })

    // 6. Percobaan pengiriman email verifikasi jika Gmail provider aktif
    let emailSent = false
    const emailEnabled = process.env.GMAIL_ENABLED === 'true'
    if (emailEnabled && process.env.GMAIL_SENDER_EMAIL) {
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'
      const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${rawVerificationToken}`

      try {
        const sendResult = await sendEmailNotification({
          applicationId: newUser.id,
          applicationNum: 'REG-' + newUser.id.slice(0, 8).toUpperCase(),
          eventType: 'SUBMITTED',
          citizenName: newUser.name,
          serviceName: 'Aktivasi Akun Warga',
          status: 'REGISTERED',
          publicNotes: `Klik tautan berikut untuk memverifikasi alamat email akun warga Anda: ${verifyUrl}`,
          email: newUser.email,
        })
        emailSent = sendResult.success
      } catch {
        emailSent = false
      }
    }

    // 7. Pengiriman notifikasi WhatsApp selamat datang jika diaktifkan di konfigurasi
    try {
      const { dispatchWhatsAppNotification } = await import('@/lib/whatsapp/whatsapp-notification-service')
      await dispatchWhatsAppNotification({
        eventType: 'ACCOUNT_REGISTRATION',
        recipientPhone: nomorTelepon,
        recipientName: newUser.name,
      })
    } catch {
      // Non-blocking: registrasi akun tetap berhasil jika gateway WA offline
    }

    return {
      success: true,
      message: 'Akun warga berhasil dibuat! Silakan masuk dengan email dan kata sandi Anda.',
      user: newUser,
      emailVerification: {
        required: false,
        sent: emailSent,
        message: emailSent
          ? 'Tautan verifikasi email telah dikirimkan ke kotak masuk Anda.'
          : 'Layanan email eksternal belum dikonfigurasi, akun Anda dapat langsung digunakan untuk masuk.',
      },
    }
  } catch (err: unknown) {
    console.error('[RegisterCitizen] Database error:', (err as Error)?.message || err)
    return {
      success: false,
      error: 'Terjadi kendala saat memproses pembuatan akun di server. Silakan coba beberapa saat lagi.',
      code: 'DATABASE_ERROR',
    }
  }
}

/**
 * Memverifikasi token email warga:
 * - Menghash raw token
 * - Memeriksa token di database & memastikan belum kedaluwarsa
 * - Menandai emailVerified dan menghapus token yang telah terpakai
 */
export async function verifyEmailToken(rawToken: string) {
  if (!rawToken || typeof rawToken !== 'string') {
    return { success: false, error: 'Token verifikasi tidak valid atau tidak disediakan' }
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!record || record.usedAt !== null) {
    return {
      success: false,
      error: 'Tautan verifikasi tidak valid atau sudah pernah digunakan sebelumnya.',
    }
  }

  if (record.expiresAt < new Date()) {
    return {
      success: false,
      error: 'Tautan verifikasi telah kedaluwarsa. Silakan ajukan pengiriman ulang jika diperlukan.',
    }
  }

  // Tandai email terverifikasi dan token terpakai dalam transaksi
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: record.userId,
        action: 'EMAIL_VERIFIED',
        entityType: 'User',
        entityId: record.userId,
      },
    }),
  ])

  return {
    success: true,
    message: 'Alamat email Anda berhasil diverifikasi!',
  }
}
