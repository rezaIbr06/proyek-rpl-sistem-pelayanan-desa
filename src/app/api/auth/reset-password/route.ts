import { NextRequest, NextResponse } from 'next/server'
import { resetPassword, verifyResetToken } from '@/lib/auth/password-service'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token tidak disediakan' }, { status: 400 })
  }

  const result = await verifyResetToken(token)
  return NextResponse.json(result, { status: result.valid ? 200 : 400 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, newPassword, confirmNewPassword } = body

    if (!token || !newPassword) {
      return NextResponse.json({ success: false, error: 'Token dan kata sandi baru wajib diisi' }, { status: 400 })
    }

    const result = await resetPassword(token, newPassword, confirmNewPassword)

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (err: unknown) {
    console.error('[API Reset Password Error]:', err)
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan pada server' }, { status: 500 })
  }
}

