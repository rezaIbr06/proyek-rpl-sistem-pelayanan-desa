import { WhatsAppNotificationEventType, WhatsAppRecipientRole } from './types';

export const DEFAULT_WHATSAPP_CONFIG = {
  provider: 'WHATSAPP_CLOUD_API',
  apiVersion: 'v19.0',
  phoneNumberId: '',
  businessAccountId: '',
  senderPhone: '',
  isEnabled: true,
  connectionStatus: 'NOT_CONFIGURED'
};

export interface DefaultTemplateDefinition {
  templateName: string;
  templateCategory: 'UTILITY' | 'AUTHENTICATION' | 'MARKETING';
  language: string;
  messageType: 'TEMPLATE' | 'TEXT';
  content: string;
  metaTemplateName: string;
  variableKeys: string[];
}

export const DEFAULT_TEMPLATES: DefaultTemplateDefinition[] = [
  {
    templateName: 'registrasi_berhasil',
    templateCategory: 'UTILITY',
    language: 'id',
    messageType: 'TEMPLATE',
    content: 'Yth. {{nama_warga}}, akun Anda pada Sistem Pelayanan Desa berhasil dibuat. Silakan login untuk menggunakan layanan desa.',
    metaTemplateName: 'registrasi_berhasil',
    variableKeys: ['nama_warga']
  },
  {
    templateName: 'verifikasi_email',
    templateCategory: 'AUTHENTICATION',
    language: 'id',
    messageType: 'TEMPLATE',
    content: 'Yth. {{nama_warga}}, silakan verifikasi akun email Anda pada Sistem Pelayanan Desa melalui tautan yang dikirimkan.',
    metaTemplateName: 'verifikasi_email',
    variableKeys: ['nama_warga']
  },
  {
    templateName: 'permohonan_diajukan',
    templateCategory: 'UTILITY',
    language: 'id',
    messageType: 'TEMPLATE',
    content: 'Yth. {{nama_warga}}, permohonan {{nama_layanan}} dengan nomor {{nomor_permohonan}} telah berhasil diajukan pada {{tanggal_pengajuan}}.',
    metaTemplateName: 'permohonan_diajukan',
    variableKeys: ['nama_warga', 'nama_layanan', 'nomor_permohonan', 'tanggal_pengajuan']
  },
  {
    templateName: 'permohonan_diproses',
    templateCategory: 'UTILITY',
    language: 'id',
    messageType: 'TEMPLATE',
    content: 'Yth. {{nama_warga}}, permohonan {{nomor_permohonan}} sedang diproses oleh petugas desa.',
    metaTemplateName: 'permohonan_diproses',
    variableKeys: ['nama_warga', 'nomor_permohonan']
  },
  {
    templateName: 'permohonan_perlu_perbaikan',
    templateCategory: 'UTILITY',
    language: 'id',
    messageType: 'TEMPLATE',
    content: 'Yth. {{nama_warga}}, permohonan {{nomor_permohonan}} memerlukan perbaikan. Keterangan: {{alasan_perbaikan}}. Silakan periksa akun Anda untuk informasi lebih lanjut.',
    metaTemplateName: 'permohonan_perlu_perbaikan',
    variableKeys: ['nama_warga', 'nomor_permohonan', 'alasan_perbaikan']
  },
  {
    templateName: 'permohonan_disetujui',
    templateCategory: 'UTILITY',
    language: 'id',
    messageType: 'TEMPLATE',
    content: 'Yth. {{nama_warga}}, permohonan {{nomor_permohonan}} telah disetujui. Silakan periksa dashboard Sistem Pelayanan Desa untuk informasi selanjutnya.',
    metaTemplateName: 'permohonan_disetujui',
    variableKeys: ['nama_warga', 'nomor_permohonan']
  },
  {
    templateName: 'permohonan_ditolak',
    templateCategory: 'UTILITY',
    language: 'id',
    messageType: 'TEMPLATE',
    content: 'Yth. {{nama_warga}}, permohonan {{nomor_permohonan}} belum dapat disetujui. Keterangan: {{alasan_penolakan}}. Silakan hubungi petugas desa jika membutuhkan informasi lebih lanjut.',
    metaTemplateName: 'permohonan_ditolak',
    variableKeys: ['nama_warga', 'nomor_permohonan', 'alasan_penolakan']
  },
  {
    templateName: 'permohonan_selesai',
    templateCategory: 'UTILITY',
    language: 'id',
    messageType: 'TEMPLATE',
    content: 'Yth. {{nama_warga}}, permohonan {{nomor_permohonan}} telah selesai diproses. Terima kasih telah menggunakan layanan desa.',
    metaTemplateName: 'permohonan_selesai',
    variableKeys: ['nama_warga', 'nomor_permohonan']
  },
  {
    templateName: 'notifikasi_staf_permohonan_baru',
    templateCategory: 'UTILITY',
    language: 'id',
    messageType: 'TEMPLATE',
    content: 'Terdapat permohonan layanan baru dengan nomor {{nomor_permohonan}} dari {{nama_warga}}. Silakan periksa dashboard petugas.',
    metaTemplateName: 'notifikasi_staf_permohonan_baru',
    variableKeys: ['nomor_permohonan', 'nama_warga']
  },
  {
    templateName: 'notifikasi_staf_tindak_lanjut',
    templateCategory: 'UTILITY',
    language: 'id',
    messageType: 'TEMPLATE',
    content: 'Pengingat: Permohonan {{nomor_permohonan}} ({{nama_layanan}}) memerlukan tindakan lanjutan segera oleh petugas.',
    metaTemplateName: 'notifikasi_staf_tindak_lanjut',
    variableKeys: ['nomor_permohonan', 'nama_layanan']
  },
  {
    templateName: 'notifikasi_staf_sla_overdue',
    templateCategory: 'UTILITY',
    language: 'id',
    messageType: 'TEMPLATE',
    content: 'Perhatian: Permohonan {{nomor_permohonan}} telah melampaui batas waktu estimasi {{estimasi_hari}} hari kerja. Mohon segera diprioritaskan.',
    metaTemplateName: 'notifikasi_staf_sla_overdue',
    variableKeys: ['nomor_permohonan', 'estimasi_hari']
  }
];

export interface DefaultSettingDefinition {
  eventType: WhatsAppNotificationEventType;
  name: string;
  description: string;
  recipientType: WhatsAppRecipientRole;
  defaultTemplateName: string;
  isEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: DefaultSettingDefinition[] = [
  // A. Notifikasi Akun
  {
    eventType: 'ACCOUNT_REGISTRATION',
    name: 'Registrasi Akun Berhasil',
    description: 'Kirim notifikasi penyambutan kepada warga saat pendaftaran akun baru berhasil.',
    recipientType: 'CITIZEN',
    defaultTemplateName: 'registrasi_berhasil',
    isEnabled: true
  },
  {
    eventType: 'EMAIL_VERIFICATION',
    name: 'Verifikasi Email Akun',
    description: 'Kirim notifikasi verifikasi email warga jika fitur verifikasi email diwajibkan.',
    recipientType: 'CITIZEN',
    defaultTemplateName: 'verifikasi_email',
    isEnabled: false
  },

  // B. Notifikasi Permohonan
  {
    eventType: 'APPLICATION_SUBMITTED',
    name: 'Permohonan Berhasil Diajukan',
    description: 'Kirim tanda terima pengajuan permohonan dan nomor berkas ke nomor WhatsApp pemohon.',
    recipientType: 'CITIZEN',
    defaultTemplateName: 'permohonan_diajukan',
    isEnabled: true
  },
  {
    eventType: 'APPLICATION_PROCESSING',
    name: 'Permohonan Sedang Diproses',
    description: 'Beri tahu pemohon bahwa berkas permohonan sedang dalam pengerjaan oleh petugas.',
    recipientType: 'CITIZEN',
    defaultTemplateName: 'permohonan_diproses',
    isEnabled: true
  },
  {
    eventType: 'APPLICATION_REVISION_REQUIRED',
    name: 'Permohonan Butuh Perbaikan Dokumen',
    description: 'Beri tahu pemohon jika ada berkas atau dokumen yang kurang lengkap dan perlu diperbaiki.',
    recipientType: 'CITIZEN',
    defaultTemplateName: 'permohonan_perlu_perbaikan',
    isEnabled: true
  },
  {
    eventType: 'APPLICATION_APPROVED',
    name: 'Permohonan Disetujui',
    description: 'Beri tahu pemohon saat permohonan dinyatakan lengkap dan diverifikasi petugas.',
    recipientType: 'CITIZEN',
    defaultTemplateName: 'permohonan_disetujui',
    isEnabled: true
  },
  {
    eventType: 'APPLICATION_REJECTED',
    name: 'Permohonan Ditolak',
    description: 'Beri tahu pemohon jika permohonan ditolak beserta alasan resmi penolakan.',
    recipientType: 'CITIZEN',
    defaultTemplateName: 'permohonan_ditolak',
    isEnabled: true
  },
  {
    eventType: 'APPLICATION_COMPLETED',
    name: 'Pelayanan Selesai & Dokumen Siap',
    description: 'Beri tahu pemohon bahwa dokumen atau surat desa telah selesai dan siap diambil di kantor desa.',
    recipientType: 'CITIZEN',
    defaultTemplateName: 'permohonan_selesai',
    isEnabled: true
  },

  // C. Notifikasi Petugas / Staf
  {
    eventType: 'STAFF_NEW_APPLICATION',
    name: 'Permohonan Baru Masuk (Petugas)',
    description: 'Pemberitahuan kepada staf pelayanan saat ada permohonan baru yang memerlukan verifikasi.',
    recipientType: 'STAFF',
    defaultTemplateName: 'notifikasi_staf_permohonan_baru',
    isEnabled: true
  },
  {
    eventType: 'STAFF_FOLLOW_UP',
    name: 'Tindak Lanjut Permohonan',
    description: 'Pengingat kepada staf untuk menindaklanjuti permohonan yang belum terselesaikan.',
    recipientType: 'STAFF',
    defaultTemplateName: 'notifikasi_staf_tindak_lanjut',
    isEnabled: false
  },
  {
    eventType: 'STAFF_SLA_OVERDUE',
    name: 'Peringatan Melewati Batas Waktu (SLA)',
    description: 'Peringatan darurat bagi staf dan supervisor jika permohonan melewati estimasi batas hari pelayanan.',
    recipientType: 'STAFF',
    defaultTemplateName: 'notifikasi_staf_sla_overdue',
    isEnabled: true
  }
];

