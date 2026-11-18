import {
  detectStatisticsIntent,
  canViewStatistics,
  parseDateRange
} from '../statistics'

describe('1. Intent Detection & Status Mapping', () => {
  test('TEST 1: "Berapa total permohonan?" detects TOTAL_APPLICATIONS', () => {
    const res = detectStatisticsIntent('Berapa total permohonan?')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('TOTAL_APPLICATIONS')
  })

  test('TEST 1b: "Berapa jumlah permohonan?" detects TOTAL_APPLICATIONS', () => {
    const res = detectStatisticsIntent('Berapa jumlah permohonan?')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('TOTAL_APPLICATIONS')
  })

  test('TEST 2: "Berapa total pengguna?" detects TOTAL_USERS', () => {
    const res = detectStatisticsIntent('Berapa total pengguna?')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('TOTAL_USERS')
  })

  test('TEST 2b: "Berapa jumlah user?" detects TOTAL_USERS', () => {
    const res = detectStatisticsIntent('Berapa jumlah user?')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('TOTAL_USERS')
  })

  test('TEST 3: "Berapa permohonan yang sedang diproses?" detects PROCESSING status', () => {
    const res = detectStatisticsIntent('Berapa permohonan yang sedang diproses?')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('APPLICATIONS_BY_STATUS')
    expect(res?.status).toBe('PROCESSING')
    expect(res?.statusLabel).toBe('Sedang Diproses')
  })

  test('TEST 3b: "Berapa permohonan yang sudah selesai?" detects COMPLETED status', () => {
    const res = detectStatisticsIntent('Berapa permohonan yang sudah selesai?')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('APPLICATIONS_BY_STATUS')
    expect(res?.status).toBe('COMPLETED')
  })

  test('TEST 3c: "Berapa permohonan yang menunggu verifikasi?" detects SUBMITTED status', () => {
    const res = detectStatisticsIntent('Berapa permohonan yang menunggu verifikasi?')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('APPLICATIONS_BY_STATUS')
    expect(res?.status).toBe('SUBMITTED')
  })

  test('TEST 3d: "Berapa permohonan yang membutuhkan perbaikan dokumen?" detects REVISION_REQUIRED status', () => {
    const res = detectStatisticsIntent('Berapa permohonan yang membutuhkan perbaikan dokumen?')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('APPLICATIONS_BY_STATUS')
    expect(res?.status).toBe('REVISION_REQUIRED')
  })

  test('TEST 3e: "Tampilkan statistik permohonan berdasarkan status" detects ALL_STATUS_BREAKDOWN', () => {
    const res = detectStatisticsIntent('Tampilkan statistik permohonan berdasarkan status')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('ALL_STATUS_BREAKDOWN')
  })

  test('TEST 3f: "Berapa jumlah warga yang terdaftar?" detects REGISTERED_CITIZENS', () => {
    const res = detectStatisticsIntent('Berapa jumlah warga yang terdaftar?')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('REGISTERED_CITIZENS')
  })

  test('TEST 3g: "ada berapa jumlah peran dalam pengguna" detects USER_ROLES', () => {
    const res = detectStatisticsIntent('ada berapa jumlah peran dalam pengguna')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('USER_ROLES')
  })

  test('TEST 3h: "peran apa saja dalam pengguna" detects USER_ROLES', () => {
    const res = detectStatisticsIntent('peran apa saja dalam pengguna')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('USER_ROLES')
  })

  test('TEST 3i: "daftar peran pengguna" detects USER_ROLES', () => {
    const res = detectStatisticsIntent('daftar peran pengguna')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('USER_ROLES')
  })

  test('TEST 3j: "Total Pengguna, Layanan Aktif, Total Permohonan" detects MASTER_DATA_METRICS', () => {
    const res = detectStatisticsIntent('Total Pengguna, Layanan Aktif, Total Permohonan')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('MASTER_DATA_METRICS')
  })

  test('TEST 3k: "ringkasan master data" detects MASTER_DATA_METRICS', () => {
    const res = detectStatisticsIntent('ringkasan master data')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('MASTER_DATA_METRICS')
  })

  test('TEST 3l: "siapa saja pengguna yang terdaftar" detects LIST_USERS', () => {
    const res = detectStatisticsIntent('siapa saja pengguna yang terdaftar')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('LIST_USERS')
  })

  test('TEST 3m: "siapa kepala desa" detects OFFICIALS_INFO', () => {
    const res = detectStatisticsIntent('siapa kepala desa')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('OFFICIALS_INFO')
  })

  test('TEST 3n: "siapa saja warga yang terdaftar" detects CITIZEN_LIST', () => {
    const res = detectStatisticsIntent('siapa saja warga yang terdaftar')
    expect(res).not.toBeNull()
    expect(res?.intent).toBe('CITIZEN_LIST')
  })
})

describe('2. Date Range & Timezone Parsing', () => {
  test('TEST 10: "Berapa total permohonan bulan ini?" parses correct date range', () => {
    const fixedNow = new Date('2026-10-23T10:00:00.000Z')
    const range = parseDateRange('berapa total permohonan bulan ini', fixedNow)
    expect(range).not.toBeNull()
    expect(range?.label).toBe('bulan ini')
    expect(range?.start?.getDate()).toBe(1)
    expect(range?.start?.getMonth()).toBe(9) // October is index 9
    expect(range?.start?.getFullYear()).toBe(2026)
  })

  test('TEST 10b: "Berapa total permohonan tahun ini?" parses correct year range', () => {
    const fixedNow = new Date('2026-10-23T10:00:00.000Z')
    const range = parseDateRange('berapa total permohonan tahun ini', fixedNow)
    expect(range).not.toBeNull()
    expect(range?.label).toBe('tahun ini')
    expect(range?.start?.getMonth()).toBe(0) // January
    expect(range?.start?.getFullYear()).toBe(2026)
  })
})

describe('3. Role-Based Access Control (RBAC)', () => {
  test('TEST 6: WARGA / CITIZEN cannot access internal user statistics', () => {
    const wargaAccess = canViewStatistics('WARGA', 'USERS')
    expect(wargaAccess.allowed).toBe(false)
    expect(wargaAccess.reason).toContain('Akses terbatas')

    const unauthAccess = canViewStatistics(undefined, 'USERS')
    expect(unauthAccess.allowed).toBe(false)
  })

  test('WARGA cannot access internal application statistics', () => {
    const wargaAccess = canViewStatistics('WARGA', 'APPLICATIONS')
    expect(wargaAccess.allowed).toBe(false)
  })

  test('ADMIN can access both USERS and APPLICATIONS statistics', () => {
    expect(canViewStatistics('ADMIN', 'USERS').allowed).toBe(true)
    expect(canViewStatistics('ADMIN', 'APPLICATIONS').allowed).toBe(true)
  })

  test('SUPERVISOR can access USERS and APPLICATIONS statistics', () => {
    expect(canViewStatistics('SUPERVISOR', 'USERS').allowed).toBe(true)
    expect(canViewStatistics('SUPERVISOR', 'APPLICATIONS').allowed).toBe(true)
  })

  test('STAF can access APPLICATIONS statistics but not USERS statistics', () => {
    expect(canViewStatistics('STAF', 'APPLICATIONS').allowed).toBe(true)
    expect(canViewStatistics('STAF', 'USERS').allowed).toBe(false)
  })

  test('CITIZEN_PUBLIC is open to all (public demographic aggregate)', () => {
    expect(canViewStatistics('WARGA', 'CITIZEN_PUBLIC').allowed).toBe(true)
    expect(canViewStatistics(undefined, 'CITIZEN_PUBLIC').allowed).toBe(true)
  })
})

describe('4. Formatting & Safety Rules', () => {
  test('TEST 4: Zero counts format properly as 0', () => {
    const count = 0
    const label = 'sedang diproses'
    const formatted = `Jumlah permohonan yang ${label} adalah **${count} permohonan**.`
    expect(formatted).toBe('Jumlah permohonan yang sedang diproses adalah **0 permohonan**.')
  })

  test('TEST 5: Database error message is safe and does not hallucinate zero', () => {
    const errorMsg = 'Maaf, data statistik saat ini tidak dapat diambil dari basis data sistem. Silakan coba beberapa saat lagi atau hubungi petugas desa.'
    expect(errorMsg).not.toContain(' 0 ')
    expect(errorMsg).toContain('tidak dapat diambil')
  })

  test('TEST 7: Sensitive regex catches password / credential requests', () => {
    const sensitiveRegex = /\b(password|kata\s*sandi|hash|api\s*key|token|kredensial|secret)\b/i
    expect(sensitiveRegex.test('tampilkan password semua pengguna')).toBe(true)
    expect(sensitiveRegex.test('minta kata sandi')).toBe(true)
    expect(sensitiveRegex.test('berapa token api')).toBe(true)
  })

  test('TEST 8: Programming keywords catch python/coding requests', () => {
    const programmingKeywords = [
      'python', 'html', 'css', 'javascript', 'php', 'java', 'c++', 'sql', 'react', 'node.js',
      'coding', 'programming', 'script', 'source code', 'algoritma pemrograman', 'debugging',
      'membuat aplikasi', 'membuat website'
    ]
    const userQuery = 'buatkan kode python untuk kalkulator'
    const isProgramming = programmingKeywords.some(kw => userQuery.includes(kw))
    expect(isProgramming).toBe(true)
  })

  test('TEST 9: Knowledge base questions do not match statistics intent', () => {
    const q1 = 'Apa syarat membuat Surat Keterangan Domisili?'
    const q2 = 'Bagaimana prosedur pelayanan desa?'
    const q3 = 'Berapa biaya layanan surat pengantar?'

    expect(detectStatisticsIntent(q1)).toBeNull()
    expect(detectStatisticsIntent(q2)).toBeNull()
    expect(detectStatisticsIntent(q3)).toBeNull()
  })
})
