/**
 * Pengujian Lengkap Fitur Registrasi Akun Warga
 * Memenuhi 14 Skenario Wajib pada Spesifikasi Tugas
 */

import { registerCitizen, verifyEmailToken, registerSchema } from '../register-service'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'

// Mock pengiriman email agar tidak mengirim email riil saat pengujian otomatis
jest.mock('@/lib/notifications/email-provider', () => ({
  sendEmailNotification: jest.fn().mockResolvedValue({
    channel: 'EMAIL',
    success: true,
    providerMessageId: 'mock-msg-12345',
  }),
  maskEmail: (email: string) => email,
}))

describe('Suite Pengujian: Fitur Registrasi Akun Warga', () => {
  const testEmailValid = `warga.test.${Date.now()}@example.com`
  const testDuplicateEmail = `duplicate.warga.${Date.now()}@example.com`

  // Fungsi pembersih tuntas untuk seluruh akun dummy tes
  const cleanTestUsers = async () => {
    try {
      const testUsers = await prisma.user.findMany({
        where: {
          email: {
            endsWith: '@example.com',
            not: {
              contains: 'auth.test.'
            }
          }
        },
        select: { id: true }
      })
      const ids = testUsers.map(u => u.id)
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
    await cleanTestUsers()
  })

  afterAll(async () => {
    await cleanTestUsers()
  })

  // Skenario 1: Registrasi dengan data valid berhasil
  test('1. Registrasi dengan data valid berhasil', async () => {
    const validData = {
      name: 'Ahmad Fauzi',
      email: testEmailValid,
      nomorTelepon: '081234567890',
      alamat: 'Dusun Sukamaju RT 01 RW 02 Desa Cibodas',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      agreeTerms: true,
    }

    const result = await registerCitizen(validData)
    expect(result.success).toBe(true)
    expect(result.user).toBeDefined()
    expect(result.user?.name).toBe('Ahmad Fauzi')
    expect(result.user?.email).toBe(testEmailValid.toLowerCase())
    expect(result.user?.role).toBe('CITIZEN')
    expect(result.user?.status).toBe('ACTIVE')

    // Verifikasi data di database
    const dbUser = await prisma.user.findUnique({
      where: { email: testEmailValid.toLowerCase() },
      include: { citizenProfile: true }
    })
    expect(dbUser).not.toBeNull()
    expect(dbUser?.citizenProfile).not.toBeNull()
    expect(dbUser?.citizenProfile?.nomorTelepon).toBe('081234567890')
    expect(dbUser?.citizenProfile?.alamat).toBe('Dusun Sukamaju RT 01 RW 02 Desa Cibodas')
  })

  // Skenario 2: Nama kosong ditolak
  test('2. Nama kosong ditolak', async () => {
    const invalidData = {
      name: '   ',
      email: `warga.${Date.now()}@example.com`,
      nomorTelepon: '081234567890',
      alamat: 'Jl. Merdeka RT 01',
      password: 'Password123',
      confirmPassword: 'Password123',
      agreeTerms: true,
    }

    const result = await registerCitizen(invalidData)
    expect(result.success).toBe(false)
    expect(result.code).toBe('VALIDATION_ERROR')
    expect(result.error).toMatch(/nama/i)
  })

  // Skenario 3: Email tidak valid ditolak
  test('3. Email tidak valid ditolak', async () => {
    const invalidData = {
      name: 'Budi Test',
      email: 'bukan-email-valid',
      nomorTelepon: '081234567890',
      alamat: 'Jl. Merdeka RT 01',
      password: 'Password123',
      confirmPassword: 'Password123',
      agreeTerms: true,
    }

    const result = await registerCitizen(invalidData)
    expect(result.success).toBe(false)
    expect(result.code).toBe('VALIDATION_ERROR')
    expect(result.error).toMatch(/email/i)
  })

  // Skenario 4: Password tidak memenuhi kebijakan ditolak
  test('4. Password tidak memenuhi kebijakan ditolak (< 8 karakter atau tanpa angka)', async () => {
    // Kurang dari 8 karakter
    const shortPasswordData = {
      name: 'Budi Test',
      email: `warga.short.${Date.now()}@example.com`,
      nomorTelepon: '081234567890',
      alamat: 'Jl. Merdeka RT 01',
      password: 'pass1',
      confirmPassword: 'pass1',
      agreeTerms: true,
    }
    const resShort = await registerCitizen(shortPasswordData)
    expect(resShort.success).toBe(false)
    expect(resShort.error).toMatch(/password|minimal 8/i)

    // Tanpa angka
    const noNumberData = {
      name: 'Budi Test',
      email: `warga.nonum.${Date.now()}@example.com`,
      nomorTelepon: '081234567890',
      alamat: 'Jl. Merdeka RT 01',
      password: 'PasswordOnly',
      confirmPassword: 'PasswordOnly',
      agreeTerms: true,
    }
    const resNoNum = await registerCitizen(noNumberData)
    expect(resNoNum.success).toBe(false)
    expect(resNoNum.error).toMatch(/angka/i)
  })

  // Skenario 5: Konfirmasi password tidak cocok ditolak
  test('5. Konfirmasi password tidak cocok ditolak', async () => {
    const mismatchData = {
      name: 'Budi Test',
      email: `warga.mismatch.${Date.now()}@example.com`,
      nomorTelepon: '081234567890',
      alamat: 'Jl. Merdeka RT 01',
      password: 'Password123',
      confirmPassword: 'PasswordLain999',
      agreeTerms: true,
    }

    const result = await registerCitizen(mismatchData)
    expect(result.success).toBe(false)
    expect(result.code).toBe('VALIDATION_ERROR')
    expect(result.error).toMatch(/konfirmasi/i)
  })

  // Skenario 6: Email duplikat ditangani dengan aman
  test('6. Email duplikat ditangani dengan aman tanpa merusak akun yang sudah ada', async () => {
    // Buat akun pertama
    const firstData = {
      name: 'Warga Asli',
      email: testDuplicateEmail,
      nomorTelepon: '081234567891',
      alamat: 'Jl. Melati No. 10',
      password: 'Password123',
      confirmPassword: 'Password123',
      agreeTerms: true,
    }
    const firstRes = await registerCitizen(firstData)
    expect(firstRes.success).toBe(true)

    // Coba daftar ulang dengan email yang sama
    const duplicateData = {
      name: 'Warga Peniru',
      email: testDuplicateEmail,
      nomorTelepon: '089999999999',
      alamat: 'Jl. Lain No. 99',
      password: 'PasswordHacked999',
      confirmPassword: 'PasswordHacked999',
      agreeTerms: true,
    }
    const dupRes = await registerCitizen(duplicateData)
    expect(dupRes.success).toBe(false)
    expect(dupRes.code).toBe('EMAIL_ALREADY_EXISTS')
    expect(dupRes.error).toMatch(/sudah terdaftar/i)

    // Pastikan akun asli TIDAK dimodifikasi
    const dbOriginal = await prisma.user.findUnique({
      where: { email: testDuplicateEmail.toLowerCase() },
      include: { citizenProfile: true }
    })
    expect(dbOriginal?.name).toBe('Warga Asli')
    expect(dbOriginal?.citizenProfile?.alamat).toBe('Jl. Melati No. 10')
  })

  // Skenario 7: Request yang mencoba menetapkan role ADMIN ditolak atau diabaikan
  test('7. Request yang mencoba menetapkan role ADMIN diabaikan, akun tetap CITIZEN', async () => {
    const exploitData = {
      name: 'Hacker Ingin Jadi Admin',
      email: `hacker.${Date.now()}@example.com`,
      nomorTelepon: '081234567892',
      alamat: 'Jl. Rawa Bebek',
      password: 'Password123',
      confirmPassword: 'Password123',
      agreeTerms: true,
      role: 'ADMIN', // Mencoba privilege escalation dari frontend
    }

    const result = await registerCitizen(exploitData)
    expect(result.success).toBe(true)
    expect(result.user?.role).toBe('CITIZEN') // Tetap CITIZEN

    // Verifikasi langsung di database
    const dbUser = await prisma.user.findUnique({
      where: { email: exploitData.email.toLowerCase() }
    })
    expect(dbUser?.role).toBe('CITIZEN')
    expect(dbUser?.role).not.toBe('ADMIN')
  })

  // Skenario 8: Password tersimpan sebagai hash
  test('8. Password tersimpan sebagai hash (bcrypt), bukan plain text', async () => {
    const rawPass = 'SuperRahasia123'
    const testData = {
      name: 'Warga Password Test',
      email: `warga.hash.${Date.now()}@example.com`,
      nomorTelepon: '081234567893',
      alamat: 'Jl. Mawar No. 5',
      password: rawPass,
      confirmPassword: rawPass,
      agreeTerms: true,
    }

    await registerCitizen(testData)
    const dbUser = await prisma.user.findUnique({
      where: { email: testData.email.toLowerCase() }
    })

    expect(dbUser).not.toBeNull()
    expect(dbUser?.passwordHash).not.toBe(rawPass)
    expect(dbUser?.passwordHash.startsWith('$2')).toBe(true) // Format bcrypt

    // Validasi hash cocok dengan password asli
    const isMatch = await bcrypt.compare(rawPass, dbUser!.passwordHash)
    expect(isMatch).toBe(true)
  })

  // Skenario 9: Respons API tidak memuat password atau hash
  test('9. Respons API tidak memuat password atau passwordHash', async () => {
    const testData = {
      name: 'Warga Response Clean',
      email: `warga.clean.${Date.now()}@example.com`,
      nomorTelepon: '081234567894',
      alamat: 'Jl. Anggrek No. 12',
      password: 'Password123',
      confirmPassword: 'Password123',
      agreeTerms: true,
    }

    const result = await registerCitizen(testData)
    expect(result.success).toBe(true)
    const resultObj = result as unknown as Record<string, unknown>
    const userObj = result.user as unknown as Record<string, unknown> | undefined
    expect(resultObj.password).toBeUndefined()
    expect(resultObj.passwordHash).toBeUndefined()
    expect(userObj?.password).toBeUndefined()
    expect(userObj?.passwordHash).toBeUndefined()
  })

  // Skenario 10: Persetujuan penggunaan data diwajibkan
  test('10. Persetujuan penggunaan data diwajibkan (agreeTerms: false ditolak)', async () => {
    const testData = {
      name: 'Warga Tolak Syarat',
      email: `warga.terms.${Date.now()}@example.com`,
      nomorTelepon: '081234567895',
      alamat: 'Jl. Dahlia No. 1',
      password: 'Password123',
      confirmPassword: 'Password123',
      agreeTerms: false,
    }

    const result = await registerCitizen(testData)
    expect(result.success).toBe(false)
    expect(result.code).toBe('VALIDATION_ERROR')
    expect(result.error).toMatch(/ketentuan|persetujuan/i)
  })

  // Skenario 11: Kegagalan database ditangani dengan aman
  test('11. Kegagalan database ditangani dengan aman dan menghasilkan error rapi', async () => {
    // Simulasikan kegagalan database
    const spy = jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('DB Connection Timeout'))

    const testData = {
      name: 'Warga DB Error Test',
      email: `warga.dberr.${Date.now()}@example.com`,
      nomorTelepon: '081234567896',
      alamat: 'Jl. Kenanga No. 2',
      password: 'Password123',
      confirmPassword: 'Password123',
      agreeTerms: true,
    }

    const result = await registerCitizen(testData)
    expect(result.success).toBe(false)
    expect(result.code).toBe('DATABASE_ERROR')
    expect(result.error).toMatch(/kendala saat memproses/i)

    spy.mockRestore()
  })

  // Skenario 12: Alur login kredensial akun warga baru berfungsi
  test('12. Kredensial akun warga baru dapat digunakan untuk autentikasi login', async () => {
    const rawPass = 'PasswordWarga123'
    const emailLoginTest = `warga.login.${Date.now()}@example.com`

    await registerCitizen({
      name: 'Warga Login Ready',
      email: emailLoginTest,
      nomorTelepon: '081234567897',
      alamat: 'Jl. Teratai RT 04',
      password: rawPass,
      confirmPassword: rawPass,
      agreeTerms: true,
    })

    const user = await prisma.user.findUnique({
      where: { email: emailLoginTest.toLowerCase() }
    })
    expect(user).not.toBeNull()
    expect(user?.status).toBe('ACTIVE')

    const isMatch = await bcrypt.compare(rawPass, user!.passwordHash)
    expect(isMatch).toBe(true)
  })

  // Skenario 13: Verifikasi email berfungsi dengan token kriptografis
  test('13. Verifikasi email berfungsi dengan token kriptografis berbatas waktu', async () => {
    const emailVerifyTest = `warga.verify.${Date.now()}@example.com`

    await registerCitizen({
      name: 'Warga Butuh Verifikasi',
      email: emailVerifyTest,
      nomorTelepon: '081234567898',
      alamat: 'Jl. Flamboyan No. 8',
      password: 'Password123',
      confirmPassword: 'Password123',
      agreeTerms: true,
    })

    const user = await prisma.user.findUnique({
      where: { email: emailVerifyTest.toLowerCase() },
      include: { emailVerificationTokens: true }
    })

    expect(user?.emailVerified).toBeNull()
    expect(user?.emailVerificationTokens.length).toBeGreaterThan(0)

    const tokenRecord = user!.emailVerificationTokens[0]
    expect(tokenRecord.tokenHash).toBeDefined()
    expect(tokenRecord.expiresAt.getTime()).toBeGreaterThan(Date.now())
    expect(tokenRecord.usedAt).toBeNull()

    // Uji token palsu / tidak valid
    const fakeRes = await verifyEmailToken('token-acak-palsu-123')
    expect(fakeRes.success).toBe(false)
    expect(fakeRes.error).toMatch(/tidak valid/i)
  })

  // Skenario 14: Validasi format nomor telepon Indonesia (desktop & mobile input)
  test('14. Validasi format nomor telepon Indonesia menolak nomor non-standar', () => {
    const baseValid = {
      name: 'Valid Name',
      email: 'valid@example.com',
      alamat: 'Jl. Kebon Sirih No. 10',
      password: 'Password123',
      confirmPassword: 'Password123',
      agreeTerms: true,
    }

    // Nomor terlalu pendek
    expect(registerSchema.safeParse({ ...baseValid, nomorTelepon: '12345' }).success).toBe(false)

    // Nomor huruf
    expect(registerSchema.safeParse({ ...baseValid, nomorTelepon: '0812abcde' }).success).toBe(false)

    // Nomor Indonesia valid (08...)
    expect(registerSchema.safeParse({ ...baseValid, nomorTelepon: '081234567890' }).success).toBe(true)

    // Nomor Indonesia valid (+628...)
    expect(registerSchema.safeParse({ ...baseValid, nomorTelepon: '+6281234567890' }).success).toBe(true)
  })
})
