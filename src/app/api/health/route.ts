import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    // Simple db query to ensure connection is working
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json(
      { status: 'success', message: 'Sistem Pelayanan Desa API is healthy, database connected.' },
      { status: 200 }
    );
  } catch (_error) {
    return NextResponse.json(
      { status: 'error', message: 'Database connection failed' },
      { status: 500 }
    );
  }
}
