'use server'

import { verifySession } from '@/lib/session'
import prisma from '@/lib/db'
import { redirect } from 'next/navigation'
import { dispatchNotification } from '@/lib/notifications/notification-service'

export async function submitApplication(serviceId: string, documents: { name: string, url: string }[]) {
  const session = await verifySession()
  if (!session || (session.role !== 'WARGA' && session.role !== 'CITIZEN')) {
    throw new Error('Unauthorized')
  }

  const profile = await prisma.citizenProfile.findUnique({
    where: { userId: session.userId }
  })

  if (!profile || !profile.nomorTelepon) {
    throw new Error('Nomor WhatsApp belum dilengkapi pada akun Anda. Silakan buka menu "Profil Saya" dan masukkan nomor WhatsApp aktif Anda terlebih dahulu agar dapat menerima pemberitahuan permohonan.')
  }

  // Verify service exists
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) throw new Error('Layanan tidak ditemukan')

  // Generate Application Number e.g. REQ-YYYYMMDD-XXXX
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomStr = Math.floor(1000 + Math.random() * 9000)
  const applicationNum = `REQ-${dateStr}-${randomStr}`

  // Create Application within transaction
  const application = await prisma.$transaction(async (tx) => {
    const newApp = await tx.serviceApplication.create({
      data: {
        applicationNum,
        citizenId: profile.id,
        serviceId: service.id,
        status: 'SUBMITTED',
        documents: {
          create: documents.map(doc => ({
            name: doc.name,
            fileUrl: doc.url
          }))
        },
        histories: {
          create: {
            statusTo: 'SUBMITTED',
            notes: 'Permohonan diajukan oleh Warga',
            changedBy: session.userId
          }
        }
      }
    })

    // Log to AuditLog
    await tx.auditLog.create({
      data: {
        userId: session.userId,
        action: 'CREATE_APPLICATION',
        entityType: 'ServiceApplication',
        entityId: newApp.id,
        details: JSON.stringify({ serviceName: service.name })
      }
    })

    // Notify all STAF
    const stafUsers = await tx.user.findMany({ where: { role: 'STAF', status: 'ACTIVE' }, select: { id: true } })
    if (stafUsers.length > 0) {
      await tx.notification.createMany({
        data: stafUsers.map(staf => ({
          userId: staf.id,
          title: 'Permohonan Baru',
          message: `Permohonan ${applicationNum} untuk ${service.name} memerlukan verifikasi Anda.`
        }))
      })
    }

    return newApp
  })

  // Kirim notifikasi eksternal (WhatsApp & Email) kepada pemohon setelah DB berhasil disimpan
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    })

    await dispatchNotification(
      session.userId,
      {
        applicationId: application.id,
        applicationNum: application.applicationNum,
        serviceName: service.name,
        citizenName: user?.name || 'Warga',
        status: 'SUBMITTED',
        eventType: 'SUBMITTED',
        phoneNumber: profile.nomorTelepon,
        email: user?.email,
        changedAt: new Date(),
      },
      'Permohonan Berhasil Diajukan',
      `Permohonan Anda (${application.applicationNum}) untuk layanan ${service.name} telah diterima dan sedang menunggu verifikasi.`
    )

    // Kirim notifikasi WhatsApp ke staf yang bertugas jika diaktifkan di pengaturan
    try {
      const { dispatchWhatsAppNotification } = await import('@/lib/whatsapp/whatsapp-notification-service')
      const staffProfiles = await prisma.citizenProfile.findMany({
        where: { user: { role: 'STAF', status: 'ACTIVE' }, nomorTelepon: { not: '' } },
        include: { user: { select: { name: true } } },
        take: 3
      })
      for (const sp of staffProfiles) {
        if (sp.nomorTelepon) {
          await dispatchWhatsAppNotification({
            eventType: 'STAFF_NEW_APPLICATION',
            recipientPhone: sp.nomorTelepon,
            recipientName: sp.user.name,
            applicationId: application.id,
            applicationNum: application.applicationNum,
            serviceName: service.name,
          })
        }
      }
    } catch {
      // Non-blocking
    }
  } catch (err) {
    // Logging aman: kegagalan notifikasi tidak membatalkan permohonan yang sudah tersimpan
    console.error('[ApplicationAction] Gagal mengirim notifikasi permohonan baru:', err instanceof Error ? err.message : 'Unknown error')
  }

  redirect(`/dashboard/warga/permohonan/${application.id}`)
}

export async function resubmitApplication(applicationId: string, newDocuments: { name: string, url: string }[]) {
  const session = await verifySession()
  if (!session || (session.role !== 'WARGA' && session.role !== 'CITIZEN')) {
    throw new Error('Unauthorized')
  }

  const profile = await prisma.citizenProfile.findUnique({
    where: { userId: session.userId }
  })
  if (!profile) throw new Error('Profil tidak ditemukan')

  const application = await prisma.serviceApplication.findUnique({
    where: { id: applicationId }
  })

  if (!application || application.citizenId !== profile.id || application.status !== 'REVISION_REQUIRED') {
    throw new Error('Permohonan tidak valid atau tidak dalam status revisi')
  }

  await prisma.$transaction(async (tx) => {
    // Upsert or create new documents
    for (const doc of newDocuments) {
      const existingDoc = await tx.applicationDocument.findFirst({
        where: { applicationId: application.id, name: doc.name }
      })

      if (existingDoc) {
        await tx.applicationDocument.update({
          where: { id: existingDoc.id },
          data: { fileUrl: doc.url, uploadedAt: new Date() }
        })
      } else {
        await tx.applicationDocument.create({
          data: {
            applicationId: application.id,
            name: doc.name,
            fileUrl: doc.url
          }
        })
      }
    }

    // Update status and history
    await tx.serviceApplication.update({
      where: { id: application.id },
      data: {
        status: 'SUBMITTED',
        histories: {
          create: {
            statusFrom: 'REVISION_REQUIRED',
            statusTo: 'SUBMITTED',
            notes: 'Pemohon telah mengirim perbaikan',
            changedBy: session.userId
          }
        }
      }
    })

    await tx.auditLog.create({
      data: {
        userId: session.userId,
        action: 'RESUBMIT_APPLICATION',
        entityType: 'ServiceApplication',
        entityId: application.id,
      }
    })

    // Notify all STAF
    const stafUsers = await tx.user.findMany({ where: { role: 'STAF', status: 'ACTIVE' }, select: { id: true } })
    if (stafUsers.length > 0) {
      await tx.notification.createMany({
        data: stafUsers.map(staf => ({
          userId: staf.id,
          title: 'Perbaikan Permohonan Masuk',
          message: `Permohonan ${application.applicationNum} telah diperbaiki oleh warga dan siap diverifikasi ulang.`
        }))
      })
    }
  })

  // Kirim notifikasi eksternal konfirmasi perbaikan dokumen
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    })
    const service = await prisma.service.findUnique({
      where: { id: application.serviceId },
      select: { name: true },
    })

    await dispatchNotification(
      session.userId,
      {
        applicationId: application.id,
        applicationNum: application.applicationNum,
        serviceName: service?.name || 'Layanan Desa',
        citizenName: user?.name || 'Warga',
        status: 'SUBMITTED',
        eventType: 'SUBMITTED',
        phoneNumber: profile.nomorTelepon,
        email: user?.email,
        changedAt: new Date(),
      },
      'Perbaikan Dokumen Terkirim',
      `Perbaikan dokumen untuk permohonan ${application.applicationNum} telah berhasil dikirim dan akan diverifikasi ulang.`
    )
  } catch (err) {
    console.error('[ApplicationAction] Gagal mengirim notifikasi perbaikan:', err instanceof Error ? err.message : 'Unknown error')
  }

  redirect(`/dashboard/warga/permohonan/${applicationId}`)
}
