import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { getAdminAIViewData } from '@/lib/ai/config-service';
import AIConfigManager from './AIConfigManager';

export const metadata = {
  title: 'Konfigurasi Model AI | Admin Desa AI',
  description: 'Kelola provider AI, model, parameter inferensi, dan kepatuhan sistem pelayanan desa.'
};

export default async function AdminAIConfigPage() {
  const session = await verifySession();

  // Strict backend RBAC check: only ADMIN allowed
  if (!session || session.role !== 'ADMIN') {
    redirect('/403');
  }

  const initialData = await getAdminAIViewData();

  return <AIConfigManager initialData={initialData} />;
}

