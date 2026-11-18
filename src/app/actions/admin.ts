'use server'

import { verifySession } from '@/lib/session'
import prisma from '@/lib/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

// --- Middleware Helper ---
async function checkAdmin() {
  const session = await verifySession()
  if (!session || session.role !== 'ADMIN') {
    throw new Error('Unauthorized. Hanya Admin yang dapat melakukan aksi ini.')
  }
  return session
}

// --- Manajemen Pengguna ---
export async function createUser(data: {
  name: string
  email: string
  password: string
  role: string
  nomorTelepon?: string
  nik?: string
  alamat?: string
}) {
  const session = await checkAdmin()
  const { name, email, password, role, nomorTelepon = '', nik = '', alamat = '' } = data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error('Email sudah terdaftar')

  const hashedPassword = await bcrypt.hash(password, 10)

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash: hashedPassword, role, status: 'ACTIVE' }
    })
    
    // Auto-create citizen profile if WARGA or CITIZEN
    if (role === 'WARGA' || role === 'CITIZEN') {
      await tx.citizenProfile.create({
        data: {
          userId: user.id,
          nik,
          nomorKk: '',
          alamat,
          nomorTelepon,
        }
      })
    }

    // Auto-create UserProfile (user_profiles)
    await tx.userProfile.create({
      data: {
        userId: user.id,
        birthPlace: null,
        birthDate: null,
        gender: null,
        areaId: null,
        additionalAddress: alamat || null,
      }
    })

    // Auto-create default UserConsent (user_consents)
    await tx.userConsent.createMany({
      data: [
        { userId: user.id, consentType: 'TERMS_OF_SERVICE', consentVersion: 'v1.0' },
        { userId: user.id, consentType: 'PRIVACY_POLICY', consentVersion: 'v1.0' },
      ]
    })

    await tx.auditLog.create({
      data: { userId: session.userId, action: 'CREATE_USER', entityType: 'User', entityId: user.id }
    })
  })

  revalidatePath('/dashboard/admin/users')
  redirect('/dashboard/admin/users')
}

export async function toggleUserStatus(userId: string) {
  const session = await checkAdmin()
  
  if (userId === session.userId) throw new Error('Tidak dapat mengubah status sendiri')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User tidak ditemukan')

  // Proteksi akun ADMIN dan SUPERVISOR agar tidak dapat dinonaktifkan
  if (user.role === 'ADMIN' || user.role === 'SUPERVISOR') {
    throw new Error('Akun Administrator dan Supervisor dilindungi dan tidak dapat dinonaktifkan')
  }

  const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { status: newStatus }
    })

    // Jika akun dinonaktifkan, cabut seluruh sesi aktif di tabel user_sessions secara instan
    if (newStatus === 'INACTIVE') {
      await tx.userSession.deleteMany({
        where: { userId }
      })
    }

    await tx.auditLog.create({
      data: { userId: session.userId, action: 'TOGGLE_USER_STATUS', entityType: 'User', entityId: user.id, details: JSON.stringify({ newStatus }) }
    })
  })

  revalidatePath('/dashboard/admin/users')
}

// --- Manajemen Layanan ---
export async function createService(data: { name: string; description: string; requirements: string[]; estimatedDays: string }) {
  const session = await checkAdmin()
  const { name, description, requirements, estimatedDays } = data

  await prisma.$transaction(async (tx) => {
    const service = await tx.service.create({
      data: { 
        name, 
        description, 
        requirements: JSON.stringify(requirements), // string array to JSON string
        estimatedDays: parseInt(estimatedDays, 10),
        isActive: true
      }
    })
    await tx.auditLog.create({
      data: { userId: session.userId, action: 'CREATE_SERVICE', entityType: 'Service', entityId: service.id }
    })
  })

  revalidatePath('/dashboard/admin/layanan')
  redirect('/dashboard/admin/layanan')
}

export async function toggleServiceStatus(serviceId: string) {
  const session = await checkAdmin()
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) throw new Error('Layanan tidak ditemukan')

  const newStatus = !service.isActive

  await prisma.$transaction(async (tx) => {
    await tx.service.update({
      where: { id: serviceId },
      data: { isActive: newStatus }
    })
    await tx.auditLog.create({
      data: { userId: session.userId, action: 'TOGGLE_SERVICE_STATUS', entityType: 'Service', entityId: service.id, details: JSON.stringify({ newStatus }) }
    })
  })

  revalidatePath('/dashboard/admin/layanan')
}

// --- Manajemen Knowledge AI ---
export async function createKnowledge(data: { title: string; content: string; category: string; source?: string; status?: string }) {
  const session = await checkAdmin()
  const { title, content, category, source, status } = data

  await prisma.$transaction(async (tx) => {
    const knowledge = await tx.aiKnowledge.create({
      data: { title, content, category, source, status: status || 'PUBLISHED', isActive: true, lastUpdatedBy: session.userId }
    })
    await tx.auditLog.create({
      data: { userId: session.userId, action: 'CREATE_KNOWLEDGE', entityType: 'AiKnowledge', entityId: knowledge.id }
    })
  })

  revalidatePath('/dashboard/admin/knowledge')
  redirect('/dashboard/admin/knowledge')
}

export async function toggleKnowledgeStatus(knowledgeId: string) {
  const session = await checkAdmin()
  const knowledge = await prisma.aiKnowledge.findUnique({ where: { id: knowledgeId } })
  if (!knowledge) throw new Error('Data tidak ditemukan')

  const newStatus = knowledge.status === 'PUBLISHED' ? 'UNPUBLISHED' : 'PUBLISHED'

  await prisma.$transaction(async (tx) => {
    await tx.aiKnowledge.update({
      where: { id: knowledgeId },
      data: { status: newStatus, lastUpdatedBy: session.userId }
    })
    await tx.auditLog.create({
      data: { userId: session.userId, action: 'TOGGLE_KNOWLEDGE_STATUS', entityType: 'AiKnowledge', entityId: knowledge.id, details: JSON.stringify({ newStatus }) }
    })
  })

  revalidatePath('/dashboard/admin/knowledge')
}
