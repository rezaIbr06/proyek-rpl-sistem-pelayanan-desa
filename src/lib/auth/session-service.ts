import crypto from 'crypto'
import prisma from '@/lib/db'

/**
 * Menghasilkan hash SHA-256 dari session token mentah.
 * Digunakan untuk memastikan hanya token terhash yang disimpan dalam database.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Menghasilkan raw session token acak kriptografis (32 bytes hex)
 */
export function generateRandomSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Membuat entri sesi baru di tabel user_sessions dengan token hash dan masa berlaku.
 */
export async function createUserSession(userId: string, durationMs: number = 24 * 60 * 60 * 1000) {
  const rawSessionToken = generateRandomSessionToken()
  const sessionTokenHash = hashSessionToken(rawSessionToken)
  const expiresAt = new Date(Date.now() + durationMs)

  const session = await prisma.userSession.create({
    data: {
      userId,
      sessionTokenHash,
      expiresAt,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
      },
    },
  })

  return {
    session,
    rawSessionToken,
    sessionTokenHash,
    expiresAt,
  }
}

/**
 * Memvalidasi session token terhadap tabel user_sessions di database.
 * Memastikan sesi ada, belum kedaluwarsa, dan status akun user ACTIVE.
 */
export async function validateUserSession(rawSessionToken: string) {
  if (!rawSessionToken || typeof rawSessionToken !== 'string') {
    return { valid: false, error: 'Token sesi tidak valid' }
  }

  const sessionTokenHash = hashSessionToken(rawSessionToken)
  const dbSession = await prisma.userSession.findUnique({
    where: { sessionTokenHash },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
      },
    },
  })

  if (!dbSession) {
    return { valid: false, error: 'Sesi tidak ditemukan atau telah kedaluwarsa' }
  }

  if (dbSession.expiresAt < new Date()) {
    // Bersihkan sesi yang telah kedaluwarsa
    await prisma.userSession.delete({ where: { id: dbSession.id } }).catch(() => {})
    return { valid: false, error: 'Sesi telah kedaluwarsa' }
  }

  if (dbSession.user.status !== 'ACTIVE') {
    return { valid: false, error: 'Akun dinonaktifkan' }
  }

  return {
    valid: true,
    session: dbSession,
    user: dbSession.user,
  }
}

/**
 * Menghapus sesi tertentu dari tabel user_sessions (Logout)
 */
export async function deleteUserSession(rawSessionToken: string) {
  if (!rawSessionToken) return
  const sessionTokenHash = hashSessionToken(rawSessionToken)
  await prisma.userSession.deleteMany({
    where: { sessionTokenHash },
  }).catch(() => {})
}

/**
 * Mencabut seluruh sesi aktif milik seorang pengguna (misal saat reset password atau akun dinonaktifkan)
 */
export async function revokeAllUserSessions(userId: string) {
  return await prisma.userSession.deleteMany({
    where: { userId },
  })
}

