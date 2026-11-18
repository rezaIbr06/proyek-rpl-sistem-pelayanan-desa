import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function DashboardIndex() {
  const session = await verifySession()

  if (!session) {
    redirect('/login')
  }

  // Redirect to the correct dashboard based on role
  switch (session.role) {
    case 'WARGA':
    case 'CITIZEN':
      redirect('/dashboard/warga')
    case 'STAF':
      redirect('/dashboard/staf')
    case 'SUPERVISOR':
      redirect('/dashboard/supervisor')
    case 'ADMIN':
      redirect('/dashboard/admin')
    default:
      redirect('/login')
  }
}
