import { NextRequest, NextResponse } from 'next/server'
import { registerCitizen } from '@/lib/auth/register-service'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting berdasarkan IP / X-Forwarded-For
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'anonymous-client'

    const rateCheck = checkRateLimit(`register:${clientIp}`, 10, 15 * 60 * 1000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Terlalu banyak permintaan pendaftaran. Silakan coba lagi dalam beberapa menit.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateCheck.resetTime - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    // 2. Parse Body JSON
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Format data request harus berupa JSON yang valid.',
          code: 'INVALID_JSON',
        },
        { status: 400 }
      )
    }

    // 3. Proses Registrasi Warga melalui service tersentralisasi
    const result = await registerCitizen(body)

    if (!result.success) {
      if (result.code === 'EMAIL_ALREADY_EXISTS') {
        return NextResponse.json(
          {
            success: false,
            error: result.error,
            code: result.code,
          },
          { status: 409 }
        )
      }

      if (result.code === 'VALIDATION_ERROR') {
        return NextResponse.json(
          {
            success: false,
            error: result.error,
            code: result.code,
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Gagal memproses pendaftaran akun.',
          code: result.code || 'INTERNAL_ERROR',
        },
        { status: 500 }
      )
    }

    // 4. Return respon sukses (HTTP 201 Created) tanpa data sensitif
    return NextResponse.json(
      {
        success: true,
        message: result.message,
        user: result.user,
        emailVerification: result.emailVerification,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error('[API /register] Unexpected error:', (error as Error)?.message || error)
    return NextResponse.json(
      {
        success: false,
        error: 'Terjadi kesalahan internal pada server.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}
