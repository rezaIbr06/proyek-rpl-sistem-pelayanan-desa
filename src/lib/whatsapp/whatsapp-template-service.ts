import prisma from '@/lib/db';
import { WhatsAppMessageType, WhatsAppTemplateCategory, WhatsAppTemplateDTO } from './types';

/**
 * Mengambil semua template WhatsApp yang tersimpan.
 */
export async function getAllWhatsAppTemplates(): Promise<WhatsAppTemplateDTO[]> {
  const templates = await prisma.whatsAppTemplate.findMany({
    orderBy: { createdAt: 'asc' }
  });

  return templates.map(t => ({
    id: t.id,
    templateName: t.templateName,
    templateCategory: t.templateCategory as WhatsAppTemplateCategory,
    language: t.language,
    messageType: t.messageType as WhatsAppMessageType,
    content: t.content,
    metaTemplateName: t.metaTemplateName,
    isActive: t.isActive
  }));
}

/**
 * Mengambil template berdasarkan templateName unik.
 */
export async function getWhatsAppTemplateByName(templateName: string) {
  return prisma.whatsAppTemplate.findUnique({
    where: { templateName }
  });
}

/**
 * Ekstraksi kunci variabel dari teks template (misal {{nama_warga}}, {{nomor_permohonan}}).
 */
export function extractTemplateVariables(content: string): string[] {
  const regex = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

/**
 * Melakukan substitusi variabel ke dalam isi template pesan.
 */
export function renderTemplateText(content: string, variables: Record<string, string>): string {
  let rendered = content;
  for (const [key, val] of Object.entries(variables)) {
    const reg = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(reg, val ?? '');
  }
  return rendered;
}

/**
 * Menyimpan atau memperbarui template pesan WhatsApp.
 */
export async function updateWhatsAppTemplate(
  id: string,
  data: {
    content?: string;
    templateCategory?: string;
    metaTemplateName?: string;
    isActive?: boolean;
  },
  adminUserId: string
) {
  const updated = await prisma.whatsAppTemplate.update({
    where: { id },
    data: {
      ...(data.content ? { content: data.content } : {}),
      ...(data.templateCategory ? { templateCategory: data.templateCategory } : {}),
      ...(data.metaTemplateName ? { metaTemplateName: data.metaTemplateName } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
    }
  });

  let validUserId: string | null = null;
  if (adminUserId) {
    const user = await prisma.user.findUnique({ where: { id: adminUserId }, select: { id: true } });
    if (user) validUserId = user.id;
  }

  await prisma.auditLog.create({
    data: {
      userId: validUserId,
      action: 'UPDATE_WHATSAPP_TEMPLATE',
      entityType: 'WhatsAppTemplate',
      entityId: updated.id,
      details: JSON.stringify({ templateName: updated.templateName, isActive: updated.isActive })
    }
  });

  return updated;
}

