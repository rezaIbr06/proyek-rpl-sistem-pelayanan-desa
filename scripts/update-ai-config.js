const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.aIConfiguration.findFirst();
  console.log('AI Config:', config);
  if (config) {
    await prisma.aIConfiguration.update({
      where: { id: config.id },
      data: {
        databaseOnlyMode: false,
        systemPrompt: 'Anda adalah Asisten Desa AI resmi yang ramah, cerdas, serbaguna, dan siap membantu warga maupun pengelola desa dalam segala pertanyaan, baik terkait pelayanan administrasi desa, informasi umum, konsultasi, maupun bantuan komputasi dan edukasi.'
      }
    });
    console.log('Updated databaseOnlyMode to false!');
  }
}

main().finally(() => prisma.$disconnect());

