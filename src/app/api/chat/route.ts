import { verifySession } from '@/lib/session';
import prisma from '@/lib/db';
import { getActiveAIConfig, getProviderCredential } from '@/lib/ai/config-service';
import { getProviderAdapter } from '@/lib/ai/providers';
import { AIProviderConfig, ChatMessage } from '@/lib/ai/types';

export const maxDuration = 45;

export async function POST(req: Request) {
  try {
    const session = await verifySession(); // returns null if not logged in
    const { messages } = await req.json();

    // Ambil konfigurasi AI aktif dari database
    const aiConfig = await getActiveAIConfig();

    // Jika AI dinonaktifkan oleh administrator
    if (!aiConfig.isEnabled) {
      return new Response(
        createStaticStream(
          'Layanan Asisten AI saat ini sedang dinonaktifkan sementara oleh Administrator Desa untuk pemeliharaan sistem. Silakan hubungi petugas kantor desa.'
        ),
        { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Vercel-AI-Data-Stream': 'v1' } }
      );
    }

    // Ambil data profil pengguna yang sedang login jika ada sesi aktif
    const user = session?.userId
      ? await prisma.user.findUnique({
          where: { id: session.userId },
          include: { citizenProfile: true }
        })
      : null;

    // Ambil konteks data permohonan pengguna jika login
    let userApplications = '';
    if (session) {
      const apps = await prisma.serviceApplication.findMany({
        where: { citizen: { userId: session.userId } },
        include: { service: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
      if (apps.length > 0) {
        userApplications = apps
          .map(
            a =>
              `- ${a.service.name} (Nomor: ${a.applicationNum}, Status: ${a.status}, Tanggal: ${a.createdAt.toLocaleDateString('id-ID')})`
          )
          .join('\n');
      }
    }

    // Ambil data master layanan, pengguna, dan knowledge untuk disertakan sebagai konteks resmi ke model AI
    const [liveTotalUsers, allServices, liveTotalApps, liveTotalKnowledge, allUsersList] = await Promise.all([
      prisma.user.count(),
      prisma.service.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      prisma.serviceApplication.count(),
      prisma.aiKnowledge.count({ where: { status: 'PUBLISHED' } }),
      prisma.user.findMany({
        select: { name: true, email: true, role: true, status: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }]
      })
    ]);

    const serviceStrings = allServices.map(s => {
      let reqs = '';
      try {
        const reqArr = JSON.parse(s.requirements);
        reqs = Array.isArray(reqArr) ? reqArr.join(', ') : s.requirements;
      } catch {
        reqs = s.requirements;
      }
      return `[LAYANAN DESA]\nNama: ${s.name}\nDeskripsi: ${s.description}\nEstimasi Waktu: ${s.estimatedDays} hari kerja\nSyarat: ${reqs}\nSumber: Database Layanan Desa`;
    });

    let knowledgeStrings: string[] = [];
    if (aiConfig.useKnowledgeBase) {
      const knowledgeItems = await prisma.aiKnowledge.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { updatedAt: 'desc' },
        take: 15
      });
      knowledgeStrings = knowledgeItems.map(
        k => `[KNOWLEDGE BASE]\nJudul: ${k.title}\nKategori: ${k.category}\nIsi: ${k.content}\nSumber: ${k.source || 'Knowledge Base Desa'}`
      );
    }

    const officialsListText = allUsersList
      .filter(u => u.role !== 'WARGA' && u.role !== 'CITIZEN')
      .map(u => `• ${u.name} (${u.email}) - Peran: ${u.role} - Status: ${u.status === 'ACTIVE' ? 'Aktif' : 'Non-aktif'}`)
      .join('\n');

    const citizensListText = allUsersList
      .filter(u => u.role === 'WARGA' || u.role === 'CITIZEN')
      .map(u => `• ${u.name} (${u.email}) - Peran: ${u.role} - Status: ${u.status === 'ACTIVE' ? 'Aktif' : 'Non-aktif'}`)
      .join('\n');

    // Bangun prompt instruksi menyeluruh untuk model AI
    const fullSystemPrompt = `${aiConfig.systemPrompt || 'Kamu adalah Asisten Desa AI yang ramah, cerdas, dan siap membantu pengguna.'}

--- INFORMASI SISTEM & KONFIGURASI ---
Nama Asisten: ${aiConfig.assistantName}
Bahasa Jawaban: ${aiConfig.responseLanguage || 'Indonesia'}

--- MASTER DATA & STATISTIK DATABASE DESA ---
• Total Pengguna Terdaftar: ${liveTotalUsers} akun
• Layanan Aktif: ${allServices.length} jenis layanan (${allServices.map(s => s.name).join(', ')})
• Total Permohonan Masuk: ${liveTotalApps} permohonan
• Artikel Pengetahuan (Knowledge Base): ${liveTotalKnowledge} artikel

--- DATA SELURUH PENGGUNA TERDAFTAR (DATABASE DESA) ---
Pejabat & Pengelola Desa:
${officialsListText}

Warga Desa Terdaftar (${allUsersList.filter(u => u.role === 'WARGA' || u.role === 'CITIZEN').length} orang):
${citizensListText}

--- DATA PENGGUNA YANG SEDANG LOGIN ---
${
  user
    ? `Nama: ${user.name}\nPeran: ${user.role}\nEmail: ${user.email}\nNIK: ${user.citizenProfile?.nik || '-'}\nNo. KK: ${
        user.citizenProfile?.nomorKk || '-'
      }\nAlamat: ${user.citizenProfile?.alamat || '-'}`
    : 'Pengguna belum login (Tamu)'
}

--- DATA PERMOHONAN PENGGUNA INI ---
${userApplications ? userApplications : 'Tidak ada riwayat permohonan aktif.'}

--- KATALOG LAYANAN & PERSYARATAN DESA ---
${serviceStrings.length > 0 ? serviceStrings.join('\n\n') : 'Tidak ada data layanan terdaftar.'}

${knowledgeStrings.length > 0 ? '--- BASIS PENGETAHUAN RESMI DESA ---\n' + knowledgeStrings.join('\n\n') : ''}

CATATAN:
Jawablah secara murni dan alami sebagai model AI. Gunakan data di atas apabila pengguna menanyakan informasi spesifik terkait desa, pengguna, layanan, profil, atau permohonan mereka, dan jawab pertanyaan umum lainnya dengan leluasa, ramah, dan solutif. Jangan membeberkan kunci rahasia/API key atau kata sandi berenkripsi.`;

    // Ambil kredensial provider yang aktif
    const credential = await getProviderCredential(aiConfig.provider);

    if (!credential.apiKey) {
      console.error(`AI Error: Provider ${aiConfig.provider} does not have an API key configured.`);
      return new Response(
        createStaticStream('Layanan AI belum dikonfigurasi dengan API Key yang valid. Silakan hubungi Administrator Sistem.'),
        { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Vercel-AI-Data-Stream': 'v1' } }
      );
    }

    const providerConfig: AIProviderConfig = {
      provider: aiConfig.provider,
      modelId: aiConfig.modelId,
      baseUrl: aiConfig.baseUrl,
      apiKey: credential.apiKey,
      temperature: aiConfig.temperature,
      topP: aiConfig.topP,
      maxTokens: aiConfig.maxTokens,
      timeout: aiConfig.timeout,
      streamingEnabled: aiConfig.streamingEnabled
    };

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: fullSystemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      }))
    ];

    const adapter = getProviderAdapter(aiConfig.provider);

    if (aiConfig.streamingEnabled) {
      const stream = await adapter.generateChatStream(providerConfig, chatMessages);
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Vercel-AI-Data-Stream': 'v1'
        }
      });
    } else {
      const text = await adapter.generateChatCompletion(providerConfig, chatMessages);
      return new Response(createStaticStream(text), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Vercel-AI-Data-Stream': 'v1'
        }
      });
    }
  } catch (error) {
    console.error('AI Chat Global Route Error:', error);
    return new Response(
      createStaticStream(`Terjadi kendala pada model AI: ${error instanceof Error ? error.message : 'Error'}`),
      { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Vercel-AI-Data-Stream': 'v1' } }
    );
  }
}

// Helper to create a static response stream
function createStaticStream(text: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('0:' + JSON.stringify(text) + '\n'));
      controller.close();
    }
  });
}
