/**
 * Tipe-tipe untuk sistem notifikasi eksternal (WhatsApp & Email).
 * Data sensitif (token, password) TIDAK boleh ada di sini.
 */

export type NotificationChannel = 'WHATSAPP' | 'EMAIL'

export type NotificationEventType =
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'REVISION_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'

export interface NotificationPayload {
  eventType: NotificationEventType
  applicationId: string
  applicationNum: string
  serviceName: string
  status: string
  citizenName: string
  phoneNumber?: string
  email?: string
  publicNotes?: string
  changedAt?: Date
}

export interface DeliveryResult {
  channel: NotificationChannel
  success: boolean
  providerMessageId?: string
  errorCode?: string
}

export interface NotificationDispatchResult {
  notificationId: string
  results: DeliveryResult[]
}
