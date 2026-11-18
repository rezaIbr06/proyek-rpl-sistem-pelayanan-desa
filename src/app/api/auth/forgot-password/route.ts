import { NextRequest, NextResponse } from 'next/server'
import { requestPasswordReset } from '@/lib/auth/password-service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email || ''

    const result = await requestPasswordReset(email)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (err: unknown) {
    console.error('[API Forgot Password Error]:', err)
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan pada server' }, { status: 500 })
  }
}

