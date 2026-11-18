'use server'

import { verifySession } from '@/lib/session'
import prisma from '@/lib/db'

export async function getNotifications() {
  const session = await verifySession()
  if (!session) return []

  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    select: {
      id: true,
      title: true,
      message: true,
      isRead: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return notifications
}

export async function getUnreadCount() {
  const session = await verifySession()
  if (!session) return 0

  const count = await prisma.notification.count({
    where: { userId: session.userId, isRead: false }
  })

  return count
}

export async function markAsRead(notificationId: string) {
  const session = await verifySession()
  if (!session) return

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.userId },
    data: { isRead: true }
  })
}

export async function markAllAsRead() {
  const session = await verifySession()
  if (!session) return

  await prisma.notification.updateMany({
    where: { userId: session.userId, isRead: false },
    data: { isRead: true }
  })
}
