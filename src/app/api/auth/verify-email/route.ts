import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailToken } from '@/lib/auth/register-service'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const isApi = req.nextUrl.searchParams.get('format') === 'json' || req.headers.get('accept')?.includes('application/json')

  if (!token) {
    if (isApi) {
      return NextResponse.json({ success: false, error: 'Token verifikasi diperlukan' }, { status: 400 })
    }
    return NextResponse.redirect(new URL('/login?error=TokenMissing', req.url))
  }

  const result = await verifyEmailToken(token)

  if (isApi) {
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  }

  if (result.success) {
    return NextResponse.redirect(new URL('/login?verified=true', req.url))
  } else {
    return NextResponse.redirect(new URL('/login?error=TokenInvalid', req.url))
  }
}
