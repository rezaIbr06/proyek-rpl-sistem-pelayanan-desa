/**
 * WhatsApp Business Cloud API Types and DTOs
 */

export type WhatsAppProviderType = 'WHATSAPP_CLOUD_API' | 'FONNTE';

export type WhatsAppMessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export type WhatsAppRecipientRole = 'CITIZEN' | 'STAFF' | 'SUPERVISOR';
export type WhatsAppRecipientType = WhatsAppRecipientRole;

export type WhatsAppTemplateCategory = 'UTILITY' | 'AUTHENTICATION' | 'MARKETING';
export type WhatsAppMessageType = 'TEMPLATE' | 'TEXT';

export type WhatsAppNotificationEventType =
  // Notifikasi Akun
  | 'ACCOUNT_REGISTRATION'
  | 'EMAIL_VERIFICATION'
  // Notifikasi Permohonan
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_PROCESSING'
  | 'APPLICATION_REVISION_REQUIRED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'APPLICATION_COMPLETED'
  // Notifikasi Petugas / Staf
  | 'STAFF_NEW_APPLICATION'
  | 'STAFF_FOLLOW_UP'
  | 'STAFF_SLA_OVERDUE';

export type WhatsAppEventType = WhatsAppNotificationEventType;

export interface WhatsAppConfigData {
  id?: string;
  provider: string;
  phoneNumberId: string;
  businessAccountId: string;
  apiVersion: string;
  senderPhone: string;
  isEnabled: boolean;
  connectionStatus: string;
  lastTestedAt?: Date | null;
  lastErrorMessage?: string | null;
  updatedBy?: string | null;
  updatedAt?: Date;
}

export interface WhatsAppAdminViewData {
  config: WhatsAppConfigData;
  credentials: {
    hasAccessToken: boolean;
    hasAppSecret: boolean;
    hasWebhookVerifyToken: boolean;
    hasFonnteToken: boolean;
    accessTokenMask: string;
    appSecretMask: string;
    webhookVerifyTokenMask: string;
    fonnteTokenMask: string;
  };
  settings: WhatsAppSettingDTO[];
  templates: WhatsAppTemplateDTO[];
  webhookUrl: string;
}

export interface WhatsAppSettingDTO {
  id: string;
  eventType: WhatsAppNotificationEventType;
  name: string;
  description: string;
  isEnabled: boolean;
  recipientType: WhatsAppRecipientRole;
  templateId?: string | null;
  templateName?: string | null;
  templateContent?: string | null;
}

export interface WhatsAppTemplateDTO {
  id: string;
  templateName: string;
  templateCategory: 'UTILITY' | 'AUTHENTICATION' | 'MARKETING';
  language: string;
  messageType: 'TEMPLATE' | 'TEXT';
  content: string;
  metaTemplateName: string;
  isActive: boolean;
}

export interface WhatsAppMessagePayload {
  to: string; // Recipient phone number (E.164, e.g. 6281234567890)
  templateName: string;
  languageCode?: string;
  bodyVariables?: Record<string, string>; // e.g. { nama_warga: 'Budi', nomor_permohonan: 'REQ-...' }
  parametersList?: string[]; // fallback indexed parameters {{1}}, {{2}}
  textFallback?: string;
  applicationId?: string;
  notificationId?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  recipientPhone: string;
  rawResponse?: unknown;
}

export interface WhatsAppConnectionTestResult {
  success: boolean;
  message: string;
  provider?: 'WHATSAPP_CLOUD_API' | 'FONNTE';
  phoneNumberId?: string;
  verifiedName?: string;
  displayPhoneNumber?: string;
  qualityRating?: string;
  deviceStatus?: string;
  deviceName?: string;
  quota?: string | number;
  latencyMs?: number;
}

export interface WhatsAppLogQueryFilters {
  status?: string;
  eventType?: string;
  applicationId?: string;
  phoneNumber?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface WhatsAppLogDTO {
  id: string;
  notificationId?: string | null;
  applicationId?: string | null;
  recipientPhone: string;
  templateName: string;
  messageStatus: string;
  providerMessageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  createdAt: string;
}

