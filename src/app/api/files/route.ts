import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import prisma from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  try {
    // 1. Verify Authentication (Warga, Staf, Supervisor, Admin all have sessions)
    const session = await verifySession()
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // 2. Get file path
    const fileName = req.nextUrl.searchParams.get('path')
    if (!fileName || fileName.includes('..') || fileName.includes('/')) {
      return new NextResponse('Invalid path', { status: 400 })
    }

    // 3. Verify Ownership (Prevent IDOR)
    if (session.role === 'WARGA' || session.role === 'CITIZEN') {
      const fileUrl = `/api/files?path=${fileName}`
      const document = await prisma.applicationDocument.findFirst({
        where: { fileUrl },
        include: { application: { include: { citizen: true } } }
      })

      // If document exists in DB, ensure it belongs to this Warga
      if (document && document.application.citizen.userId !== session.userId) {
        return new NextResponse('Forbidden', { status: 403 })
      }
    }

    const filePath = path.join(process.cwd(), '.storage', fileName)

    if (!fs.existsSync(filePath)) {
      return new NextResponse('File not found', { status: 404 })
    }

    // 3. Read file and send it
    const fileBuffer = fs.readFileSync(filePath)
    const ext = path.extname(fileName).toLowerCase()
    
    let contentType = 'application/octet-stream'
    if (ext === '.pdf') contentType = 'application/pdf'
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
    if (ext === '.png') contentType = 'image/png'

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Prevent caching for sensitive files, or cache securely
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    console.error('File server error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
