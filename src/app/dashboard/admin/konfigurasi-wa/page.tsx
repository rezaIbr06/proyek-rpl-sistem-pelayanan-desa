import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { getWhatsAppAdminViewData } from '@/lib/whatsapp/whatsapp-config-service';
import WhatsAppConfigManager from './WhatsAppConfigManager';

export const metadata = {
  title: 'Konfigurasi WhatsApp Business API | Admin Desa AI',
  description: 'Kelola integrasi WhatsApp Business Cloud API Meta, template pesan, dan event notifikasi warga.'
};

export default async function AdminWhatsAppConfigPage() {
  const session = await verifySession();

  // Strict backend RBAC check: only ADMIN allowed
  if (!session || session.role !== 'ADMIN') {
    redirect('/403');
  }

  const initialData = await getWhatsAppAdminViewData();

  return <WhatsAppConfigManager initialData={initialData} />;
}

