import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { uploadFile } from '@/lib/storage'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Authentication
    const session = await verifySession()
    if (!session || (session.role !== 'WARGA' && session.role !== 'CITIZEN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse FormData
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // 3. Validate File
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File melebihi batas 5MB' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipe file tidak diizinkan. Gunakan PDF, JPG, atau PNG.' }, { status: 400 })
    }

    // 4. Save File
    const fileUrl = await uploadFile(file)

    return NextResponse.json({ url: fileUrl }, { status: 200 })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Internal server error during upload' }, { status: 500 })
  }
}
