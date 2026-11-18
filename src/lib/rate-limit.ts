/**
 * In-memory sliding window rate limiter untuk melindungi endpoint publik
 * dari brute force dan flooding.
 */

interface RateLimitRecord {
  timestamps: number[]
}

const store = new Map<string, RateLimitRecord>()

// Bersihkan data lama setiap 10 menit
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    const windowMs = 15 * 60 * 1000
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter(t => now - t < windowMs)
      if (record.timestamps.length === 0) {
        store.delete(key)
      }
    }
  }, 10 * 60 * 1000).unref?.()
}

export function checkRateLimit(
  identifier: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const record = store.get(identifier) || { timestamps: [] }

  // Buang timestamp yang sudah di luar jendela waktu
  record.timestamps = record.timestamps.filter(t => now - t < windowMs)

  if (record.timestamps.length >= limit) {
    const oldestTimestamp = record.timestamps[0]
    const resetTime = oldestTimestamp + windowMs
    return { allowed: false, remaining: 0, resetTime }
  }

  record.timestamps.push(now)
  store.set(identifier, record)

  return {
    allowed: true,
    remaining: limit - record.timestamps.length,
    resetTime: now + windowMs,
  }
}

export function resetRateLimit(identifier: string): void {
  store.delete(identifier)
}
