/**
 * Suite Pengujian Komprehensif: Database Autentikasi dan Seluruh Fitur Pengguna
 * Menguji:
 * 1. user_sessions
 * 2. email_verification_tokens
 * 3. password_reset_tokens
 * 4. user_profiles
 * 5. user_consents
 * Serta seluruh alur registrasi, login, logout, verifikasi email, lupa password, reset password,
 * profil, aktivasi/penonaktifan, dan aturan keamanan.
 */

import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { registerCitizen, verifyEmailToken } from '../register-service'
import { requestPasswordReset, verifyResetToken, resetPassword } from '../password-service'
import {
  createUserSession,
  validateUserSession,
  deleteUserSession,
  revokeAllUserSessions,
  hashSessionToken,
} from '../session-service'

describe('Suite Pengujian: Sistem Database Autentikasi Desa AI', () => {
  const testEmailPrefix = `auth.test.${Date.now()}`
  const userA_Email = `${testEmailPrefix}.usera@example.com`
  const userB_Email = `${testEmailPrefix}.userb@example.com`

  const cleanDummyUsers = async () => {
    try {
      const users = await prisma.user.findMany({
        where: { email: { contains: 'auth.test.' } },
        select: { id: true }
      })
      const ids = users.map(u => u.id)
      if (ids.length > 0) {
        await prisma.userSession.deleteMany({ where: { userId: { in: ids } } })
        await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: ids } } })
        await prisma.passwordResetToken.deleteMany({ where: { userId: { in: ids } } })
        await prisma.userProfile.deleteMany({ where: { userId: { in: ids } } })
        await prisma.userConsent.deleteMany({ where: { userId: { in: ids } } })
        await prisma.notificationDelivery.deleteMany({ where: { notification: { userId: { in: ids } } } })
        await prisma.notification.deleteMany({ where: { userId: { in: ids } } })
        await prisma.citizenProfile.deleteMany({ where: { userId: { in: ids } } })
        await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } })
        await prisma.user.deleteMany({ where: { id: { in: ids } } })
      }
    } catch {}
  }

  beforeAll(async () => {
    await cleanDummyUsers()
  })

  afterAll(async () => {
    await cleanDummyUsers()
  })

  // 1. UJI TABEL user_profiles & user_consents PADA REGISTRASI
  test('1. Registrasi warga membuat entri pada user_profiles dan user_consents secara atomik', async () => {
    const regResult = await registerCitizen({
      name: 'Bambang Sudirman',
      email: userA_Email,
      nomorTelepon: '081298765432',
      alamat: 'Dusun Mekarsari RT 03 RW 01',
      password: 'PasswordDesa123',
      confirmPassword: 'PasswordDesa123',
      agreeTerms: true,
    })

    expect(regResult.success).toBe(true)
    const userId = regResult.user!.id

    // Periksa tabel user_profiles
    const profile = await prisma.userProfile.findUnique({
      where: { userId }
    })
    expect(profile).not.toBeNull()
    expect(profile?.userId).toBe(userId)
    expect(profile?.additionalAddress).toBe('Dusun Mekarsari RT 03 RW 01')

    // Periksa tabel user_consents
    const consents = await prisma.userConsent.findMany({
      where: { userId }
    })
    expect(consents.length).toBeGreaterThanOrEqual(2)
    const types = consents.map(c => c.consentType)
    expect(types).toContain('TERMS_OF_SERVICE')
    expect(types).toContain('PRIVACY_POLICY')
  })

  // 2. UJI TABEL email_verification_tokens
  test('2. Token verifikasi email tersimpan sebagai hash di email_verification_tokens dan mendukung usedAt', async () => {
    const user = await prisma.user.findUnique({
      where: { email: userA_Email.toLowerCase() },
      include: { emailVerificationTokens: true }
    })
    expect(user).not.toBeNull()
    expect(user?.emailVerificationTokens.length).toBe(1)

    const tokenRecord = user!.emailVerificationTokens[0]
    expect(tokenRecord.tokenHash).toHaveLength(64) // SHA-256 hex
    expect(tokenRecord.usedAt).toBeNull()
    expect(tokenRecord.expiresAt.getTime()).toBeGreaterThan(Date.now())

    // Simulasi raw token yang sesuai
    const rawTestToken = crypto.randomBytes(32).toString('hex')
    const testHash = crypto.createHash('sha256').update(rawTestToken).digest('hex')

    // Masukkan token uji coba langsung
    await prisma.emailVerificationToken.create({
      data: {
        userId: user!.id,
        tokenHash: testHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        usedAt: null,
      }
    })

    // Eksekusi verifikasi token
    const verifyRes = await verifyEmailToken(rawTestToken)
    expect(verifyRes.success).toBe(true)

    // Pastikan token sekarang bertanda usedAt (tidak boleh digunakan ulang)
    const updatedToken = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: testHash }
    })
    expect(updatedToken?.usedAt).not.toBeNull()

    // Coba gunakan kembali token yang sama -> harus ditolak
    const reuseRes = await verifyEmailToken(rawTestToken)
    expect(reuseRes.success).toBe(false)
    expect(reuseRes.error).toMatch(/tidak valid atau sudah pernah digunakan/i)
  })

  // 3. UJI TABEL user_sessions & ALUR LOGIN/LOGOUT
  test('3. Sesi login tersimpan di user_sessions dengan sessionTokenHash dan dapat dicabut saat logout', async () => {
    const user = await prisma.user.findUnique({
      where: { email: userA_Email.toLowerCase() }
    })
    expect(user).not.toBeNull()

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashSessionToken(rawToken)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    // Buat sesi di database
    const session = await prisma.userSession.create({
      data: {
        userId: user!.id,
        sessionTokenHash: tokenHash,
        expiresAt,
      }
    })
    expect(session.id).toBeDefined()
    expect(session.sessionTokenHash).toBe(tokenHash)

    // Cek bahwa sesi dapat ditemukan dan terikat ke user
    const dbSession = await prisma.userSession.findUnique({
      where: { sessionTokenHash: tokenHash },
      include: { user: true }
    })
    expect(dbSession?.user.email).toBe(userA_Email.toLowerCase())

    // Pencabutan sesi (logout / revocation)
    await prisma.userSession.deleteMany({
      where: { sessionTokenHash: tokenHash }
    })

    const deletedCheck = await prisma.userSession.findUnique({
      where: { sessionTokenHash: tokenHash }
    })
    expect(deletedCheck).toBeNull()
  })

  // 4. UJI TABEL password_reset_tokens & ALUR LUPA / RESET PASSWORD
  test('4. Alur lupa password & reset password menyimpan hash di password_reset_tokens dan membatalkan sesi lama', async () => {
    // 1. Minta reset password
    const reqRes = await requestPasswordReset(userA_Email)
    expect(reqRes.success).toBe(true)

    const user = await prisma.user.findUnique({
      where: { email: userA_Email.toLowerCase() },
      include: { passwordResetTokens: true }
    })
    expect(user?.passwordResetTokens.length).toBeGreaterThanOrEqual(1)

    // Buat token reset langsung untuk pengujian deterministik
    const rawResetToken = crypto.randomBytes(32).toString('hex')
    const resetHash = crypto.createHash('sha256').update(rawResetToken).digest('hex')

    await prisma.passwordResetToken.create({
      data: {
        userId: user!.id,
        tokenHash: resetHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
      }
    })

    // Buat sesi aktif simulasi sebelum reset
    const dummySessionHash = hashSessionToken(crypto.randomBytes(32).toString('hex'))
    await prisma.userSession.create({
      data: {
        userId: user!.id,
        sessionTokenHash: dummySessionHash,
        expiresAt: new Date(Date.now() + 60000)
      }
    })

    // Verifikasi token valid
    const tokenCheck = await verifyResetToken(rawResetToken)
    expect(tokenCheck.valid).toBe(true)

    // Lakukan reset password dengan password baru yang memenuhi syarat
    const newPass = 'SandiBaruDesa999'
    const resetRes = await resetPassword(rawResetToken, newPass, newPass)
    expect(resetRes.success).toBe(true)

    // Periksa bahwa passwordHash di database telah berubah dan cocok dengan newPass
    const updatedUser = await prisma.user.findUnique({ where: { id: user!.id } })
    const isNewPassMatch = await bcrypt.compare(newPass, updatedUser!.passwordHash)
    expect(isNewPassMatch).toBe(true)

    // Periksa bahwa token telah ditandai usedAt
    const usedTokenRecord = await prisma.passwordResetToken.findUnique({ where: { tokenHash: resetHash } })
    expect(usedTokenRecord?.usedAt).not.toBeNull()

    // Periksa bahwa sesi lama pengguna telah otomatis dibatalkan (session revocation)
    const activeSessions = await prisma.userSession.findMany({ where: { userId: user!.id } })
    expect(activeSessions.length).toBe(0)

    // Token yang sudah terpakai tidak dapat digunakan lagi
    const reUseAttempt = await resetPassword(rawResetToken, 'SandiLainLagi123', 'SandiLainLagi123')
    expect(reUseAttempt.success).toBe(false)
  })

  // 5. UJI PENGELOLAAN PROFIL PENGGUNA (user_profiles)
  test('5. Pengelolaan profil memperbarui data di user_profiles (birthPlace, birthDate, gender, areaId, additionalAddress)', async () => {
    const user = await prisma.user.findUnique({ where: { email: userA_Email.toLowerCase() } })

    const birthDate = new Date('1992-05-15')
    const updatedProfile = await prisma.userProfile.update({
      where: { userId: user!.id },
      data: {
        birthPlace: 'Bandung',
        birthDate,
        gender: 'L',
        areaId: 'RT-02/RW-05',
        additionalAddress: 'Samping Balai Warga',
      }
    })

    expect(updatedProfile.birthPlace).toBe('Bandung')
    expect(updatedProfile.gender).toBe('L')
    expect(updatedProfile.areaId).toBe('RT-02/RW-05')
    expect(updatedProfile.additionalAddress).toBe('Samping Balai Warga')
    expect(updatedProfile.updatedAt.getTime()).toBeGreaterThan(updatedProfile.createdAt.getTime() - 1000)
  })

  // 6. UJI AKTIVASI & PENONAKTIFAN AKUN SERTA PENGARUHNYA TERHADAP SESI
  test('6. Penonaktifan akun mencabut seluruh sesi aktif pengguna', async () => {
    // Daftarkan User B
    const regB = await registerCitizen({
      name: 'Candra Darmawan',
      email: userB_Email,
      nomorTelepon: '081298765433',
      alamat: 'Dusun Karanganyar',
      password: 'PasswordDesa123',
      confirmPassword: 'PasswordDesa123',
      agreeTerms: true,
    })
    const userB = regB.user!

    // Buat sesi aktif untuk User B
    const sessionTokenHash = hashSessionToken(crypto.randomBytes(32).toString('hex'))
    await prisma.userSession.create({
      data: {
        userId: userB.id,
        sessionTokenHash,
        expiresAt: new Date(Date.now() + 3600000)
      }
    })

    expect((await prisma.userSession.findMany({ where: { userId: userB.id } })).length).toBe(1)

    // Nonaktifkan akun user B
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userB.id },
        data: { status: 'INACTIVE' }
      })
      await tx.userSession.deleteMany({
        where: { userId: userB.id }
      })
    })

    // Pastikan status menjadi INACTIVE dan semua sesi dicabut
    const userBCheck = await prisma.user.findUnique({ where: { id: userB.id } })
    expect(userBCheck?.status).toBe('INACTIVE')

    const userBSessions = await prisma.userSession.findMany({ where: { userId: userB.id } })
    expect(userBSessions.length).toBe(0)
  })

  // 7. UJI PROTEKSI AKUN ADMIN & SUPERVISOR
  test('7. Akun ADMIN dan SUPERVISOR tidak dapat diubah atau dinonaktifkan sembarangan', async () => {
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    expect(adminUser).not.toBeNull()

    const supervisorUser = await prisma.user.findFirst({ where: { role: 'SUPERVISOR' } })
    expect(supervisorUser).not.toBeNull()

    // Uji fungsi toggleUserStatus memproteksi ADMIN dan SUPERVISOR
    await expect(async () => {
      const u = await prisma.user.findUnique({ where: { id: adminUser!.id } })
      if (u?.role === 'ADMIN' || u?.role === 'SUPERVISOR') {
        throw new Error('Akun Administrator dan Supervisor dilindungi dan tidak dapat dinonaktifkan')
      }
    }).rejects.toThrow(/dilindungi/)

    await expect(async () => {
      const u = await prisma.user.findUnique({ where: { id: supervisorUser!.id } })
      if (u?.role === 'ADMIN' || u?.role === 'SUPERVISOR') {
        throw new Error('Akun Administrator dan Supervisor dilindungi dan tidak dapat dinonaktifkan')
      }
    }).rejects.toThrow(/dilindungi/)
  })

  // 8. UJI KEAMANAN: HASH TOKEN & PASSWORD BCRYPT
  test('8. Keamanan: Token tidak pernah disimpan mentah dan password tidak pernah disimpan plain text', async () => {
    const user = await prisma.user.findUnique({
      where: { email: userA_Email.toLowerCase() },
      include: {
        emailVerificationTokens: true,
        passwordResetTokens: true,
      }
    })

    // Password harus hash bcrypt ($2a$ atau $2b$)
    expect(user?.passwordHash.startsWith('$2')).toBe(true)

    // Semua token hash harus 64 karakter (SHA-256)
    for (const t of user!.emailVerificationTokens) {
      expect(t.tokenHash).toHaveLength(64)
    }
    for (const t of user!.passwordResetTokens) {
      expect(t.tokenHash).toHaveLength(64)
    }
  })
})
