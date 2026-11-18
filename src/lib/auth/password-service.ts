import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { z } from 'zod'
import { sendEmailNotification } from '@/lib/notifications/email-provider'

export const passwordPolicySchema = z
  .string()
  .min(1, 'Kata sandi baru wajib diisi')
  .min(8, 'Kata sandi minimal 8 karakter')
  .max(72, 'Kata sandi maksimal 72 karakter')
  .regex(/[A-Za-z]/, 'Kata sandi harus mengandung setidaknya satu huruf')
  .regex(/[0-9]/, 'Kata sandi harus mengandung setidaknya satu angka')

export const resetPasswordInputSchema = z
  .object({
    token: z.string().min(1, 'Token reset kata sandi wajib diisi'),
    newPassword: passwordPolicySchema,
    confirmNewPassword: z.string().min(1, 'Konfirmasi kata sandi wajib diisi'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Konfirmasi kata sandi tidak cocok dengan kata sandi baru',
    path: ['confirmNewPassword'],
  })

export interface RequestResetResult {
  success: boolean
  message: string
  error?: string
  resetUrl?: string // populated in development for convenience
}

export interface ResetPasswordResult {
  success: boolean
  message: string
  error?: string
}

/**
 * Meminta tautan reset kata sandi (Lupa Password):
 * - Memverifikasi keberadaan user
 * - Menghasilkan token acak kriptografis (32 bytes hex)
 * - Menyimpan hash token ke tabel password_reset_tokens dengan masa berlaku 1 jam
 * - Mengirimkan notifikasi via Email atau WhatsApp jika layanan aktif
 * - Mencatat AuditLog
 */
export async function requestPasswordReset(emailRaw: string): Promise<RequestResetResult> {
  const email = emailRaw?.trim().toLowerCase()
  if (!email || !z.string().email().safeParse(email).success) {
    return {
      success: false,
      error: 'Format alamat email tidak valid',
      message: 'Format alamat email tidak valid',
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { citizenProfile: true },
    })

    // Tangani dengan aman tanpa membuka informasi eksistensi akun
    if (!user || user.status !== 'ACTIVE') {
      return {
        success: true,
        message: 'Jika alamat email terdaftar dalam sistem desa, tautan pemulihan kata sandi telah dikirimkan.',
      }
    }

    // Buat token kriptografis acak
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 jam

    // Simpan ke database password_reset_tokens
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        usedAt: null,
      },
    })

    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`

    // Catat log audit permintaan reset
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'REQUEST_PASSWORD_RESET',
        entityType: 'User',
        entityId: user.id,
        details: JSON.stringify({ email }),
      },
    })

    // Percobaan kirim email jika Gmail aktif
    const emailEnabled = process.env.GMAIL_ENABLED === 'true'
    if (emailEnabled && process.env.GMAIL_SENDER_EMAIL) {
      try {
        await sendEmailNotification({
          applicationId: user.id,
          applicationNum: 'RST-' + user.id.slice(0, 8).toUpperCase(),
          eventType: 'SUBMITTED',
          citizenName: user.name,
          serviceName: 'Pemulihan Kata Sandi',
          status: 'RESET_REQUESTED',
          publicNotes: `Silakan klik tautan berikut untuk membuat kata sandi baru akun Anda (berlaku 1 jam): ${resetUrl}`,
          email: user.email,
        })
      } catch (e) {
        console.warn('[PasswordReset] Gagal mengirim email:', e)
      }
    }

    // Percobaan kirim WhatsApp jika nomor telepon warga tersedia
    if (user.citizenProfile?.nomorTelepon) {
      try {
        const { dispatchWhatsAppNotification } = await import('@/lib/whatsapp/whatsapp-notification-service')
        await dispatchWhatsAppNotification({
          eventType: 'ACCOUNT_REGISTRATION',
          recipientPhone: user.citizenProfile.nomorTelepon,
          recipientName: user.name,
        })
      } catch {
        // Non-blocking
      }
    }

    return {
      success: true,
      message: 'Jika alamat email terdaftar dalam sistem desa, tautan pemulihan kata sandi telah dikirimkan.',
      resetUrl: process.env.NODE_ENV !== 'production' ? resetUrl : undefined,
    }
  } catch (err: unknown) {
    console.error('[requestPasswordReset Error]:', err)
    return {
      success: false,
      error: 'Terjadi kendala saat memproses permintaan reset kata sandi.',
      message: 'Terjadi kendala saat memproses permintaan reset kata sandi.',
    }
  }
}

/**
 * Validasi apakah token reset masih aktif dan belum kedaluwarsa/digunakan
 */
export async function verifyResetToken(rawToken: string) {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, error: 'Token tidak valid' }
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, name: true, status: true } } },
  })

  if (!record || record.usedAt !== null) {
    return { valid: false, error: 'Tautan reset kata sandi tidak valid atau sudah digunakan.' }
  }

  if (record.expiresAt < new Date()) {
    return { valid: false, error: 'Tautan reset kata sandi telah kedaluwarsa.' }
  }

  if (record.user.status !== 'ACTIVE') {
    return { valid: false, error: 'Akun ini dalam status tidak aktif.' }
  }

  return { valid: true, userId: record.userId, user: record.user }
}

/**
 * Memperbarui kata sandi dengan token yang sah:
 * - Memeriksa token di tabel password_reset_tokens
 * - Memvalidasi kebijakan kekuatan password
 * - Menghash password baru dengan bcrypt
 * - Memperbarui user.passwordHash & menandai token usedAt
 * - Menghapus seluruh sesi aktif user di user_sessions (revocation)
 * - Mencatat AuditLog
 */
export async function resetPassword(
  rawToken: string,
  newPassword: string,
  confirmNewPassword?: string
): Promise<ResetPasswordResult> {
  const parseResult = resetPasswordInputSchema.safeParse({
    token: rawToken,
    newPassword,
    confirmNewPassword: confirmNewPassword ?? newPassword,
  })

  if (!parseResult.success) {
    const msg = parseResult.error.issues?.[0]?.message || 'Input kata sandi tidak valid'
    return { success: false, error: msg, message: msg }
  }

  const tokenVerification = await verifyResetToken(rawToken)
  if (!tokenVerification.valid || !tokenVerification.userId) {
    return {
      success: false,
      error: tokenVerification.error || 'Token reset kata sandi tidak valid atau telah kedaluwarsa.',
      message: tokenVerification.error || 'Token reset kata sandi tidak valid atau telah kedaluwarsa.',
    }
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const passwordHash = await bcrypt.hash(newPassword, 10)

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Update password hash user
      await tx.user.update({
        where: { id: tokenVerification.userId },
        data: { passwordHash },
      })

      // 2. Tandai token sudah digunakan
      await tx.passwordResetToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      })

      // 3. Batalkan seluruh sesi aktif pengguna di tabel user_sessions
      await tx.userSession.deleteMany({
        where: { userId: tokenVerification.userId },
      })

      // 4. Catat AuditLog
      await tx.auditLog.create({
        data: {
          userId: tokenVerification.userId,
          action: 'RESET_PASSWORD',
          entityType: 'User',
          entityId: tokenVerification.userId,
          details: JSON.stringify({ success: true }),
        },
      })
    })

    return {
      success: true,
      message: 'Kata sandi berhasil diperbarui! Silakan masuk dengan kata sandi baru Anda.',
    }
  } catch (err: unknown) {
    console.error('[resetPassword Database Error]:', err)
    return {
      success: false,
      error: 'Terjadi kegagalan basis data saat memperbarui kata sandi.',
      message: 'Terjadi kegagalan basis data saat memperbarui kata sandi.',
    }
  }
}

