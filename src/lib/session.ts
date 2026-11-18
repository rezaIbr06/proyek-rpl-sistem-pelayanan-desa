import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { cache } from 'react'
import prisma from '@/lib/db'
import {
  createUserSession,
  validateUserSession,
  deleteUserSession,
  revokeAllUserSessions,
  hashSessionToken,
} from '@/lib/auth/session-service'

const secretKey = process.env.SESSION_SECRET || 'super-secret-key-for-desa-ai-development'
const key = new TextEncoder().encode(secretKey)

export type SessionPayload = {
  userId: string
  role: string
  name: string
  sessionToken?: string
  expiresAt: Date
}

export { hashSessionToken, revokeAllUserSessions }

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(key)
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ['HS256'],
    })
    return payload as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(userId: string, role: string, name: string) {
  const { rawSessionToken, sessionTokenHash, expiresAt } = await createUserSession(userId)

  const session = await encrypt({
    userId,
    role,
    name,
    sessionToken: rawSessionToken,
    expiresAt,
  })

  const cookieStore = await cookies()
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })

  return { sessionToken: rawSessionToken, sessionTokenHash, expiresAt }
}

export const verifySession = cache(async () => {
  const cookieStore = await cookies()
  const cookie = cookieStore.get('session')?.value
  const session = await decrypt(cookie)

  if (!session?.userId) {
    return null
  }

  // If session token exists, verify against user_sessions table via session-service
  if (session.sessionToken) {
    const result = await validateUserSession(session.sessionToken)
    if (!result.valid || !result.user || !result.session) {
      return null
    }

    return {
      isAuth: true,
      userId: result.user.id,
      role: result.user.role,
      name: result.user.name,
      sessionId: result.session.id,
    }
  }

  // Fallback check for user validity
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, role: true, status: true },
  })

  if (!user || user.status !== 'ACTIVE') {
    return null
  }

  return { isAuth: true, userId: user.id, role: user.role, name: user.name }
})

export async function deleteSession() {
  const cookieStore = await cookies()
  const cookie = cookieStore.get('session')?.value
  const session = await decrypt(cookie)

  if (session?.sessionToken) {
    await deleteUserSession(session.sessionToken)
  }

  cookieStore.delete('session')
}
