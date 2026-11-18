'use server'

import { verifySession } from '@/lib/session'
import prisma from '@/lib/db'
import { redirect } from 'next/navigation'
import { dispatchNotification } from '@/lib/notifications/notification-service'
import type { NotificationEventType } from '@/lib/notifications/types'

export async function updateApplicationStatus(
  applicationId: string,
  newStatus: string,
  notes?: string
) {
  const session = await verifySession()
  if (!session || (session.role !== 'STAF' && session.role !== 'ADMIN')) {
    throw new Error('Unauthorized')
  }

  const validStatuses = ['VERIFIED', 'PROCESSING', 'COMPLETED', 'REVISION_REQUIRED', 'REJECTED']
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Status tidak valid')
  }

  const application = await prisma.serviceApplication.findUnique({
    where: { id: applicationId },
    include: {
      service: { select: { name: true } },
      citizen: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  if (!application) {
    throw new Error('Permohonan tidak ditemukan')
  }

  // Update status and add history within a transaction
  await prisma.$transaction(async (tx) => {
    await tx.serviceApplication.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        processedAt: newStatus === 'PROCESSING' || newStatus === 'VERIFIED' ? new Date() : undefined,
        completedAt: newStatus === 'COMPLETED' || newStatus === 'REJECTED' ? new Date() : undefined,
      },
    })

    await tx.applicationHistory.create({
      data: {
        applicationId: application.id,
        statusFrom: application.status,
        statusTo: newStatus,
        notes: notes || null,
        changedBy: session.userId,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: session.userId,
        action: 'UPDATE_APPLICATION_STATUS',
        entityType: 'ServiceApplication',
        entityId: application.id,
        details: JSON.stringify({ oldStatus: application.status, newStatus, notes }),
      },
    })
  })

  // Event & pesan notifikasi
  const statusToEventType: Record<string, NotificationEventType> = {
    VERIFIED: 'APPROVED',
    PROCESSING: 'PROCESSING',
    REVISION_REQUIRED: 'REVISION_REQUIRED',
    COMPLETED: 'COMPLETED',
    REJECTED: 'REJECTED',
  }

  const statusMessages: Record<string, { title: string; message: string }> = {
    VERIFIED: {
      title: 'Permohonan Disetujui',
      message: `Permohonan ${application.applicationNum} telah disetujui petugas.`,
    },
    PROCESSING: {
      title: 'Permohonan Sedang Diproses',
      message: `Permohonan ${application.applicationNum} sedang dalam proses pengerjaan oleh petugas.`,
    },
    REVISION_REQUIRED: {
      title: 'Perbaikan Dokumen Diperlukan',
      message: `Permohonan ${application.applicationNum} memerlukan perbaikan dokumen. ${notes ? 'Catatan: ' + notes : ''}`,
    },
    COMPLETED: {
      title: 'Pelayanan Selesai',
      message: `Permohonan ${application.applicationNum} telah selesai diproses. Dokumen/surat dapat diambil.`,
    },
    REJECTED: {
      title: 'Permohonan Ditolak',
      message: `Permohonan ${application.applicationNum} tidak dapat diproses. ${notes ? 'Alasan: ' + notes : ''}`,
    },
  }

  const eventType = statusToEventType[newStatus]
  const notifContent = statusMessages[newStatus]

  if (eventType && notifContent && application.citizen?.user) {
    try {
      await dispatchNotification(
        application.citizen.user.id,
        {
          applicationId: application.id,
          applicationNum: application.applicationNum,
          serviceName: application.service.name,
          citizenName: application.citizen.user.name,
          status: newStatus,
          eventType,
          publicNotes: notes || undefined,
          phoneNumber: application.citizen.nomorTelepon,
          email: application.citizen.user.email,
          changedAt: new Date(),
        },
        notifContent.title,
        notifContent.message
      )
    } catch (err) {
      console.error('[StaffAction] Gagal mengirim notifikasi status permohonan:', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  redirect(`/dashboard/staf/permohonan/${applicationId}`)
}
