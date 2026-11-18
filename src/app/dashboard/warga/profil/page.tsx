import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import WargaProfilForm from './WargaProfilForm'

export default async function WargaProfilPage() {
  const session = await verifySession()

  if (session?.role !== 'WARGA' && session?.role !== 'CITIZEN') {
    redirect('/403')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { citizenProfile: true, userProfile: true }
  })

  if (!user || !user.citizenProfile) {
    return <div>Profil tidak ditemukan.</div>
  }

  const p = user.citizenProfile
  const up = user.userProfile

  const serializedProfile = {
    nik: p.nik || '',
    nomorKk: p.nomorKk || '',
    nomorTelepon: p.nomorTelepon,
    alamat: p.alamat,
    tempatLahir: up?.birthPlace || p.tempatLahir,
    tanggalLahir: (up?.birthDate || p.tanggalLahir) ? (up?.birthDate || p.tanggalLahir)!.toISOString() : null,
    jenisKelamin: up?.gender || p.jenisKelamin,
    pekerjaan: p.pekerjaan,
    agama: p.agama,
    areaId: up?.areaId || '',
    additionalAddress: up?.additionalAddress || '',
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.875rem', marginBottom: '0.35rem', color: '#ffffff', fontWeight: 800 }}>Profil Saya</h1>
        <p style={{ color: '#ffffff', opacity: 0.95, fontSize: '0.875rem', margin: 0, fontWeight: 500 }}>
          Lengkapi data diri Anda, terutama nomor WhatsApp agar mendapatkan notifikasi otomatis terkait permohonan layanan.
        </p>
      </div>

      <WargaProfilForm
        user={{ name: user.name, email: user.email }}
        profile={serializedProfile}
      />
    </div>
  )
}

