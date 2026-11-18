'use server'

import { z } from 'zod'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createSession, deleteSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { requestPasswordReset, resetPassword } from '@/lib/auth/password-service'

const loginSchema = z.object({
  email: z.string().email({ message: 'Email tidak valid' }).trim(),
  password: z.string().min(1, { message: 'Password tidak boleh kosong' }),
})

export async function login(formData: FormData) {
  // Validate form fields
  const validatedFields = loginSchema.safeParse(Object.fromEntries(formData))

  if (!validatedFields.success) {
    redirect('/login?error=InvalidInput')
  }

  const { password } = validatedFields.data
  const email = validatedFields.data.email.toLowerCase()

  // Fetch user using unique index
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  })

  if (!user) {
    redirect('/login?error=InvalidCredentials')
  }

  if (user.status !== 'ACTIVE') {
    redirect('/login?error=AccountInactive')
  }

  // Check password
  const passwordsMatch = await bcrypt.compare(password, user.passwordHash)

  if (!passwordsMatch) {
    redirect('/login?error=InvalidCredentials')
  }

  // Create session (persisted in user_sessions database) and log audit concurrently
  await Promise.all([
    createSession(user.id, user.role, user.name),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id,
        details: JSON.stringify({ ip: 'unknown' }),
      }
    })
  ])

  // Redirect to dashboard based on role
  let redirectPath = '/dashboard/warga'
  if (user.role === 'STAF') redirectPath = '/dashboard/staf'
  else if (user.role === 'SUPERVISOR') redirectPath = '/dashboard/supervisor'
  else if (user.role === 'ADMIN') redirectPath = '/dashboard/admin'

  redirect(redirectPath)
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}

export async function registerUser(formData: FormData) {
  const { registerCitizen } = await import('@/lib/auth/register-service')
  
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    nomorTelepon: formData.get('nomorTelepon'),
    alamat: formData.get('alamat'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    agreeTerms: formData.get('agreeTerms') === 'true' || formData.get('agreeTerms') === 'on',
  }

  const result = await registerCitizen(rawData)

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Gagal mendaftar',
      code: result.code,
    }
  }

  return {
    success: true,
    message: result.message,
    user: result.user,
  }
}

export async function handleForgotPassword(formData: FormData) {
  const email = (formData.get('email') as string) || ''
  return await requestPasswordReset(email)
}

export async function handleResetPassword(formData: FormData) {
  const token = (formData.get('token') as string) || ''
  const newPassword = (formData.get('newPassword') as string) || ''
  const confirmNewPassword = (formData.get('confirmNewPassword') as string) || ''

  return await resetPassword(token, newPassword, confirmNewPassword)
}
