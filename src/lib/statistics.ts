import prisma from './db'
import { Prisma } from '@prisma/client'

export type ApplicationStatus =
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'REVISION_REQUIRED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'

export interface ApplicationStatistics {
  total: number
  byStatus: {
    SUBMITTED: number
    VERIFIED: number
    REVISION_REQUIRED: number
    PROCESSING: number
    COMPLETED: number
    REJECTED: number
  }
}

export interface UserStatistics {
  total: number
  warga: number
  staf: number
  supervisor: number
  admin: number
  activeCount: number
}

export interface DateRangeFilter {
  start?: Date
  end?: Date
  label?: string
}

/**
 * Normalizes input text for regex & intent matching.
 */
export function normalizeQuery(text: string): string {
  return text.toLowerCase().trim()
}

/**
 * Parses relative time ranges like "bulan ini", "tahun ini", "minggu ini", "hari ini"
 * using the server's locale and consistent date boundaries.
 */
export function parseDateRange(query: string, now: Date = new Date()): DateRangeFilter | null {
  const q = normalizeQuery(query)

  if (q.includes('hari ini')) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return { start, end, label: 'hari ini' }
  }

  if (q.includes('minggu ini')) {
    const day = now.getDay() // 0 is Sunday, 1 is Monday...
    const diffToMonday = day === 0 ? 6 : day - 1
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0)
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
    return { start, end, label: 'minggu ini' }
  }

  if (q.includes('bulan ini')) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return { start, end, label: 'bulan ini' }
  }

  if (q.includes('tahun ini')) {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
    return { start, end, label: 'tahun ini' }
  }

  return null
}

/**
 * Status mapping dictionary from common Indonesian terms to database enum values.
 */
export const STATUS_MAPPING: Record<string, ApplicationStatus> = {
  // PROCESSING
  'sedang diproses': 'PROCESSING',
  'proses': 'PROCESSING',
  'diproses': 'PROCESSING',
  'dalam proses': 'PROCESSING',

  // COMPLETED
  'selesai': 'COMPLETED',
  'sudah selesai': 'COMPLETED',
  'telah selesai': 'COMPLETED',

  // VERIFIED
  'terverifikasi': 'VERIFIED',
  'telah diverifikasi': 'VERIFIED',
  'sudah diverifikasi': 'VERIFIED',
  'lolos verifikasi': 'VERIFIED',

  // SUBMITTED (menunggu verifikasi / diajukan)
  'menunggu verifikasi': 'SUBMITTED',
  'menunggu': 'SUBMITTED',
  'antrean': 'SUBMITTED',
  'antri': 'SUBMITTED',
  'baru masuk': 'SUBMITTED',
  'baru': 'SUBMITTED',
  'diajukan': 'SUBMITTED',

  // REVISION_REQUIRED
  'membutuhkan perbaikan': 'REVISION_REQUIRED',
  'butuh perbaikan': 'REVISION_REQUIRED',
  'perbaikan dokumen': 'REVISION_REQUIRED',
  'perbaikan berkas': 'REVISION_REQUIRED',
  'perlu revisi': 'REVISION_REQUIRED',
  'revisi': 'REVISION_REQUIRED',

  // REJECTED
  'ditolak': 'REJECTED'
}

/**
 * Human-readable label in Indonesian for each status.
 */
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Menunggu Verifikasi',
  VERIFIED: 'Terverifikasi',
  PROCESSING: 'Sedang Diproses',
  REVISION_REQUIRED: 'Membutuhkan Perbaikan Dokumen',
  COMPLETED: 'Selesai',
  REJECTED: 'Ditolak'
}

/**
 * Server-side query: Total applications with optional status and date filter.
 */
export async function getTotalApplications(filter?: {
  status?: ApplicationStatus
  dateRange?: DateRangeFilter | null
  citizenId?: string
}): Promise<number> {
  const where: Prisma.ServiceApplicationWhereInput = {}

  if (filter?.status) {
    where.status = filter.status
  }

  if (filter?.citizenId) {
    where.citizen = { userId: filter.citizenId }
  }

  if (filter?.dateRange?.start && filter?.dateRange?.end) {
    where.createdAt = {
      gte: filter.dateRange.start,
      lte: filter.dateRange.end
    }
  }

  return await prisma.serviceApplication.count({ where })
}

/**
 * Server-side query: Total users with optional role or status filter.
 */
export async function getTotalUsers(filter?: {
  role?: string
  status?: string
  dateRange?: DateRangeFilter | null
}): Promise<number> {
  const where: Prisma.UserWhereInput = {}

  if (filter?.role) {
    where.role = filter.role
  }

  if (filter?.status) {
    where.status = filter.status
  }

  if (filter?.dateRange?.start && filter?.dateRange?.end) {
    where.createdAt = {
      gte: filter.dateRange.start,
      lte: filter.dateRange.end
    }
  }

  return await prisma.user.count({ where })
}

/**
 * Server-side query: Applications count grouped by status.
 */
export async function getApplicationStatistics(filter?: {
  dateRange?: DateRangeFilter | null
  citizenId?: string
}): Promise<ApplicationStatistics> {
  const where: Prisma.ServiceApplicationWhereInput = {}

  if (filter?.citizenId) {
    where.citizen = { userId: filter.citizenId }
  }

  if (filter?.dateRange?.start && filter?.dateRange?.end) {
    where.createdAt = {
      gte: filter.dateRange.start,
      lte: filter.dateRange.end
    }
  }

  const [
    total,
    submitted,
    verified,
    revision,
    processing,
    completed,
    rejected
  ] = await Promise.all([
    prisma.serviceApplication.count({ where }),
    prisma.serviceApplication.count({ where: { ...where, status: 'SUBMITTED' } }),
    prisma.serviceApplication.count({ where: { ...where, status: 'VERIFIED' } }),
    prisma.serviceApplication.count({ where: { ...where, status: 'REVISION_REQUIRED' } }),
    prisma.serviceApplication.count({ where: { ...where, status: 'PROCESSING' } }),
    prisma.serviceApplication.count({ where: { ...where, status: 'COMPLETED' } }),
    prisma.serviceApplication.count({ where: { ...where, status: 'REJECTED' } })
  ])

  return {
    total,
    byStatus: {
      SUBMITTED: submitted,
      VERIFIED: verified,
      REVISION_REQUIRED: revision,
      PROCESSING: processing,
      COMPLETED: completed,
      REJECTED: rejected
    }
  }
}

/**
 * Server-side query: User statistics breakdown.
 */
export async function getUserStatistics(filter?: {
  dateRange?: DateRangeFilter | null
}): Promise<UserStatistics> {
  const where: Prisma.UserWhereInput = {}

  if (filter?.dateRange?.start && filter?.dateRange?.end) {
    where.createdAt = {
      gte: filter.dateRange.start,
      lte: filter.dateRange.end
    }
  }

  const [
    total,
    warga,
    staf,
    supervisor,
    admin,
    activeCount
  ] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, role: 'WARGA' } }),
    prisma.user.count({ where: { ...where, role: 'STAF' } }),
    prisma.user.count({ where: { ...where, role: 'SUPERVISOR' } }),
    prisma.user.count({ where: { ...where, role: 'ADMIN' } }),
    prisma.user.count({ where: { ...where, status: 'ACTIVE' } })
  ])

  return {
    total,
    warga,
    staf,
    supervisor,
    admin,
    activeCount
  }
}

/**
 * Role-Based Access Control verification for database statistics.
 *
 * Rules:
 * - ADMIN: full access to system users and application statistics.
 * - SUPERVISOR: operational access to application statistics and general user counts.
 * - STAF: operational access to service application statistics for service duties.
 * - WARGA (CITIZEN) / Unauthenticated (Guest):
 *   NOT allowed to see full system-wide internal statistics (e.g. total internal users, system accounts).
 *   Only allowed to see aggregate public registered citizen counts ("warga yang terdaftar")
 *   or their own personal application data.
 */
export function canViewStatistics(role: string | undefined, statisticType: 'USERS' | 'APPLICATIONS' | 'CITIZEN_PUBLIC' | 'AUDIT_LOGS' | 'NOTIFICATIONS'): {
  allowed: boolean
  reason?: string
} {
  const normalizedRole = role?.toUpperCase()

  if (statisticType === 'CITIZEN_PUBLIC') {
    // Public aggregate of registered citizens is safe to view by anyone
    return { allowed: true }
  }

  if (statisticType === 'AUDIT_LOGS' || statisticType === 'NOTIFICATIONS') {
    if (normalizedRole === 'ADMIN') {
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: 'Akses terbatas: Log aktivitas audit dan monitor notifikasi sistem hanya dapat diakses oleh Administrator Sistem.'
    }
  }

  if (statisticType === 'USERS') {
    if (normalizedRole === 'ADMIN' || normalizedRole === 'SUPERVISOR') {
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: 'Akses terbatas: Informasi statistik seluruh pengguna sistem hanya dapat diakses oleh Administrator dan Supervisor.'
    }
  }

  if (statisticType === 'APPLICATIONS') {
    if (['ADMIN', 'SUPERVISOR', 'STAF'].includes(normalizedRole || '')) {
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: 'Akses terbatas: Statistik operasional seluruh permohonan desa hanya dapat diakses oleh staf pelayanan, supervisor, dan administrator desa.'
    }
  }

  return { allowed: false, reason: 'Akses tidak diizinkan.' }
}

/**
 * Statistics Intent Identification.
 */
export type StatIntentType =
  | 'TOTAL_APPLICATIONS'
  | 'APPLICATIONS_BY_STATUS'
  | 'ALL_STATUS_BREAKDOWN'
  | 'TOTAL_USERS'
  | 'REGISTERED_CITIZENS'
  | 'USER_ROLES'
  | 'MASTER_DATA_METRICS'
  | 'LIST_USERS'
  | 'OFFICIALS_INFO'
  | 'CITIZEN_LIST'
  | 'TOTAL_KNOWLEDGE'
  | 'RECENT_ACTIVITIES'
  | 'NOTIFICATION_MONITOR'
  | null

export interface StatIntentResult {
  intent: StatIntentType
  status?: ApplicationStatus
  statusLabel?: string
  dateRange?: DateRangeFilter | null
}

export function detectStatisticsIntent(query: string): StatIntentResult | null {
  const q = normalizeQuery(query)

  // 1. Check for specific status questions FIRST (e.g. "Berapa permohonan yang sedang diproses?")
  const isApplicationQuestion =
    q.includes('permohonan') ||
    q.includes('pengajuan') ||
    q.includes('surat') ||
    q.includes('berkas')

  const isCountQuestion =
    q.includes('berapa') ||
    q.includes('total') ||
    q.includes('jumlah') ||
    q.includes('statistik') ||
    q.includes('tampilkan statistik')

  // Ringkasan Master Data & Metrik Sistem (Total Pengguna, Layanan Aktif, Total Permohonan, Dashboard Admin)
  const masterDataRegex = /\b(dashboard(\s+admin)?|master\s+data|ringkasan\s+(data|sistem|desa|metrik|master|dashboard)|metrik\s+(kesehatan\s+)?sistem|statistik\s+(desa|sistem|umum|master)|(total\s+pengguna.*layanan\s+aktif)|(layanan\s+aktif.*total\s+permohonan)|(total\s+pengguna.*total\s+permohonan)|(apa\s+saja\s+(yang\s+ada\s+)?di\s+dashboard)|data\s+(di\s+)?dashboard(\s+admin)?)\b/i
  const isMasterDataQuestion = masterDataRegex.test(q)

  // Peran Pengguna / Role User Regex
  const userRolesRegex = /\b(peran\s+(dalam\s+)?(pengguna|user|sistem|aplikasi|akun)|(ada\s+berapa(\s+jumlah)?|berapa(\s+jumlah)?)\s+(peran|role)|(daftar|jenis)\s+(peran|role)|(peran|role)\s+apa\s+saja|tingkatan\s+(pengguna|akun|role))\b/i
  const isRoleQuestion = userRolesRegex.test(q)

  // Daftar Pengguna / User Terdaftar di Database (Kelola Pengguna)
  const listUsersRegex = /\b(kelola\s+pengguna|tabel\s+(kelola\s+)?(pengguna|user|akun)|daftar\s+(seluruh\s+)?(pengguna|user|akun|nama)|siapa\s+(saja|aja)\s+(pengguna|user|akun|nama|nama\s*nama)|(pengguna|user|akun)\s+siapa\s+(saja|aja)|ada\s+siapa\s+(saja|aja)\s+di\s+sistem|nama\s*nama\s+(dalam\s+)?(pengguna|user|akun|sistem)|siapa\s+(saja|aja)\s+nama\s*nama\s*(nya|pengguna)?|data\s+(seluruh\s+)?(pengguna|user|akun)|semua\s+(ini|pengguna|akun)|baca\s+semua\s+(ini|pengguna|akun)|tidak\s+bisa\s+baca\s+semua\s+ini|nama\s+email\s+(dan\s+)?role|status\s+pengguna)\b/i
  const isListUsersQuestion = listUsersRegex.test(q)

  // Pejabat Desa / Perangkat Desa (Kepala Desa, Staf Pelayanan, Admin)
  const officialsRegex = /\b(siapa\s+(kepala\s+desa|kades|pimpinan\s+desa|lurah|staf(\s+pelayanan)?|petugas(\s+desa|\s+pelayanan)?|admin(\s+sistem|\s+desa)?|administrator)|(pejabat|perangkat)\s+desa\s+siapa\s+saja)\b/i
  const isOfficialsQuestion = officialsRegex.test(q)

  // Daftar Warga Terdaftar
  const citizenListRegex = /\b(siapa\s+saja\s+warga(\s+yang\s+terdaftar)?|daftar\s+warga(\s+yang\s+terdaftar)?|warga\s+siapa\s+saja)\b/i
  const isCitizenListQuestion = citizenListRegex.test(q)

  const auditRegex = /\b(aktivitas\s+(sistem|terbaru)|log\s+audit|audit\s+log|riwayat\s+aktivitas|catatan\s+aktivitas)\b/i
  const notifRegex = /\b(monitor\s+notifikasi|status\s+integrasi|riwayat\s+pengiriman(\s+notifikasi)?|status\s+pengiriman(\s+notifikasi)?|statistik\s+notifikasi)\b/i

  if (
    !isCountQuestion &&
    !isApplicationQuestion &&
    !isRoleQuestion &&
    !isMasterDataQuestion &&
    !isListUsersQuestion &&
    !isOfficialsQuestion &&
    !isCitizenListQuestion &&
    !auditRegex.test(q) &&
    !notifRegex.test(q)
  ) {
    return null
  }

  const dateRange = parseDateRange(q)

  // Question 9: "Tampilkan statistik permohonan berdasarkan status" / "rekap permohonan"
  if (
    (q.includes('statistik') || q.includes('rekap') || q.includes('laporan') || q.includes('rincian')) &&
    isApplicationQuestion &&
    (q.includes('status') || q.includes('semua') || q.includes('berdasarkan') || q.includes('keseluruhan'))
  ) {
    return {
      intent: 'ALL_STATUS_BREAKDOWN',
      dateRange
    }
  }

  // Specific status detection
  for (const [key, mappedStatus] of Object.entries(STATUS_MAPPING)) {
    if (q.includes(key) && isApplicationQuestion) {
      return {
        intent: 'APPLICATIONS_BY_STATUS',
        status: mappedStatus,
        statusLabel: STATUS_LABELS[mappedStatus],
        dateRange
      }
    }
  }

  // Ringkasan Master Data & Metrik Sistem: "Total Pengguna, Layanan Aktif, Total Permohonan", "ringkasan master data"
  if (isMasterDataQuestion) {
    return {
      intent: 'MASTER_DATA_METRICS',
      dateRange
    }
  }

  // Question 1 & 2: "Berapa total permohonan?" / "Berapa jumlah permohonan?"
  if (
    isApplicationQuestion &&
    (q.includes('total permohonan') ||
      q.includes('jumlah permohonan') ||
      q.includes('total pengajuan') ||
      q.includes('jumlah pengajuan') ||
      (q.includes('berapa') && (q.includes('permohonan') || q.includes('pengajuan')) && (q.includes('semua') || q.includes('seluruh') || q.includes('total') || q.includes('jumlah'))))
  ) {
    return {
      intent: 'TOTAL_APPLICATIONS',
      dateRange
    }
  }

  // Direct regex for general "Berapa (total/jumlah) permohonan"
  const generalAppRegex = /\b(berapa\s+(total\s+|jumlah\s+)?permohonan|total\s+permohonan|jumlah\s+permohonan)\b/i
  if (generalAppRegex.test(q)) {
    return {
      intent: 'TOTAL_APPLICATIONS',
      dateRange
    }
  }

  // Peran Pengguna / Role User: "ada berapa jumlah peran dalam pengguna", "peran apa saja dalam pengguna", "daftar peran pengguna"
  if (userRolesRegex.test(q)) {
    return {
      intent: 'USER_ROLES',
      dateRange
    }
  }

  // Pejabat Desa / Perangkat Desa: "siapa kepala desa", "siapa kades", "siapa staf pelayanan", "siapa admin sistem"
  if (isOfficialsQuestion) {
    return {
      intent: 'OFFICIALS_INFO',
      dateRange
    }
  }

  // Daftar Pengguna Terdaftar di Database: "daftar pengguna", "siapa saja pengguna yang terdaftar"
  if (isListUsersQuestion) {
    return {
      intent: 'LIST_USERS',
      dateRange
    }
  }

  // Daftar Warga Terdaftar: "siapa saja warga yang terdaftar", "daftar warga"
  if (isCitizenListQuestion) {
    return {
      intent: 'CITIZEN_LIST',
      dateRange
    }
  }

  // Question 4: "Berapa jumlah warga yang terdaftar?" / "Berapa total warga?"
  const citizenCountRegex = /\b(jumlah\s+warga(\s+yang\s+terdaftar)?|total\s+warga(\s+yang\s+terdaftar)?|berapa\s+(jumlah\s+|total\s+)?warga(\s+yang\s+terdaftar)?)\b/i
  if (citizenCountRegex.test(q)) {
    return {
      intent: 'REGISTERED_CITIZENS',
      dateRange
    }
  }

  // Question 3: "Berapa total pengguna?" / "Berapa jumlah akun?"
  const userCountRegex = /\b(total\s+pengguna|jumlah\s+pengguna|berapa\s+(total\s+|jumlah\s+)?pengguna|total\s+user|jumlah\s+user|total\s+akun|jumlah\s+akun)\b/i
  if (userCountRegex.test(q)) {
    return {
      intent: 'TOTAL_USERS',
      dateRange
    }
  }

  // Artikel AI / Knowledge Base: "Berapa total artikel AI?", "jumlah artikel knowledge"
  const knowledgeRegex = /\b(artikel(\s+ai)?|knowledge(\s*base)?|basis\s+pengetahuan)\b/i
  if (knowledgeRegex.test(q) && isCountQuestion) {
    return {
      intent: 'TOTAL_KNOWLEDGE',
      dateRange
    }
  }

  // Aktivitas Sistem Terbaru / Audit Logs: "aktivitas sistem terbaru", "log aktivitas", "riwayat audit", "audit log"
  if (auditRegex.test(q)) {
    return {
      intent: 'RECENT_ACTIVITIES',
      dateRange
    }
  }

  // Monitor Notifikasi / Integrasi / Pengiriman: "monitor notifikasi", "status integrasi", "riwayat pengiriman notifikasi"
  if (notifRegex.test(q)) {
    return {
      intent: 'NOTIFICATION_MONITOR',
      dateRange
    }
  }

  return null
}
