'use server'

import { verifySession } from '@/lib/session'
import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function updateCitizenProfile(formData: FormData) {
  const session = await verifySession()
  if (!session || (session.role !== 'WARGA' && session.role !== 'CITIZEN')) {
    throw new Error('Unauthorized')
  }

  const rawNik = (formData.get('nik') as string)?.trim() ?? ''
  const nik = rawNik.length > 0 ? rawNik : null
  const rawKk = (formData.get('nomorKk') as string)?.trim() ?? ''
  const nomorKk = rawKk.length > 0 ? rawKk : null
  const nomorTelepon = (formData.get('nomorTelepon') as string)?.trim() ?? ''
  const alamat = (formData.get('alamat') as string)?.trim() ?? ''
  const tempatLahir = (formData.get('tempatLahir') as string)?.trim() || null
  const tanggalLahirRaw = formData.get('tanggalLahir') as string
  const tanggalLahir = tanggalLahirRaw ? new Date(tanggalLahirRaw) : null
  const jenisKelamin = (formData.get('jenisKelamin') as string) || null
  const pekerjaan = (formData.get('pekerjaan') as string) || null
  const agama = (formData.get('agama') as string) || null
  const areaId = (formData.get('areaId') as string)?.trim() || null
  const additionalAddress = (formData.get('additionalAddress') as string)?.trim() || null

  await prisma.$transaction(async (tx) => {
    // 1. Update/Upsert CitizenProfile
    await tx.citizenProfile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        nik,
        nomorKk,
        nomorTelepon,
        alamat,
        tempatLahir,
        tanggalLahir,
        jenisKelamin,
        pekerjaan,
        agama,
      },
      update: {
        nik,
        nomorKk,
        nomorTelepon,
        alamat,
        tempatLahir,
        tanggalLahir,
        jenisKelamin,
        pekerjaan,
        agama,
      },
    })

    // 2. Update/Upsert UserProfile (tabel user_profiles)
    await tx.userProfile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        birthPlace: tempatLahir,
        birthDate: tanggalLahir,
        gender: jenisKelamin,
        areaId,
        additionalAddress: additionalAddress || alamat,
      },
      update: {
        birthPlace: tempatLahir,
        birthDate: tanggalLahir,
        gender: jenisKelamin,
        areaId,
        additionalAddress: additionalAddress || alamat,
      },
    })

    // 3. Catat AuditLog
    await tx.auditLog.create({
      data: {
        userId: session.userId,
        action: 'UPDATE_PROFILE',
        entityType: 'UserProfile',
        entityId: session.userId,
      },
    })
  })

  revalidatePath('/dashboard/warga/profil')
  revalidatePath('/dashboard/warga')
}
