# Proyek RPL: Sistem Pelayanan Desa Berbasis Web

Selamat datang di repositori resmi proyek Rekayasa Perangkat Lunak (RPL) **Sistem Pelayanan Desa**. Aplikasi ini dirancang untuk mendigitalkan administrasi desa, mempermudah permohonan surat-menyurat warga secara mandiri, serta dilengkapi dengan fitur kecerdasan buatan (AI) interaktif untuk melayani pertanyaan warga.

---

## 👤 Informasi Mahasiswa & Kelompok

| Data Mahasiswa / Kelompok | Keterangan |
| :--- | :--- |
| **Nama** | **Muhamad Reza Ibrahim** |
| **NIM** | **41257122** |
| **Kelompok** | **Cyber, Dev, Learning (DEVLYN)** |
| **Tema Topik Kelompok** | **Sistem Pelayanan Desa** |

---

## 📹 Tautan Video Demonstrasi

Tonton video presentasi dan demonstrasi sistem aplikasi melalui tautan berikut:

🔗 **[Tonton Video Demonstrasi Aplikasi di Google Drive](https://drive.google.com/file/d/1t_LZ1yHqaV0ypHUYmvpM4GGSO6KcHv1F/view?usp=sharing)**

---

## 📖 Deskripsi Aplikasi & Fitur AI

### 1. Deskripsi Aplikasi
**Sistem Pelayanan Desa** adalah platform digital administrasi desa yang menghubungkan masyarakat (warga) dengan aparatur kantor desa secara cepat, efisien, transparan, dan akuntabel. Aplikasi ini mengotomatiskan proses pengajuan surat keterangan/pelayanan, verifikasi berkas, persetujuan bertingkat, hingga penelusuran status berkas permohonan secara *real-time*.

**Peran Pengguna (Multi-Role):**
- **Admin**: Mengelola seluruh pengguna sistem, data master layanan desa, pengaturan aplikasi, dan konfigurasi AI/LLM.
- **Supervisor (Kepala Desa)**: Meninjau permohonan layanan pada tahap validasi akhir dan melakukan persetujuan (*approval*).
- **Staf Pelayanan**: Melakukan verifikasi awal dokumen dan berkas persyaratan yang diajukan oleh warga.
- **Warga (Citizen)**: Mengajukan surat keterangan atau izin, memantau perkembangan status permohonan secara langsung, dan berinteraksi dengan asisten pintar desa.

### 2. Fitur AI (Asisten AI Desa)
Aplikasi terintegrasi dengan teknologi *Artificial Intelligence / Large Language Model (LLM)* interaktif yang berfungsi sebagai layanan mandiri (self-service assistant) bagi masyarakat desa:
- **Asisten Percakapan Interaktif (Floating Chat Widget)**: Warga dapat bertanya seputar persyaratan surat, alur birokrasi desa, estimasi waktu penyelesaian, dan informasi layanan kapan saja.
- **Konteks Cerdas Berbasis Data Desa**: AI secara langsung dibekali pemahaman kontekstual terhadap master data layanan desa, Knowledge Base internal, dan riwayat permohonan pengguna yang sedang login.
- **Multi-Provider & Konfigurasi Fleksibel**: Admin desa dapat mengelola konfigurasi AI dari dashboard (pengaturan model OpenAI / Google Gemini / NVIDIA NIM, system prompt, temperature, streaming, dan Knowledge Base).
- **Format Respons Markdown & Rekomendasi Pertanyaan**: Menampilkan balasan dengan format terstruktur (daftar list, poin-poin, tautan) serta tombol *quick-prompt* pertanyaan populer.

---

## 🛠️ Petunjuk Instalasi Aplikasi (Setup Instruction)

Ikuti langkah-langkah di bawah ini untuk menjalankan aplikasi pada lingkungan lokal (*development*):

### Prasyarat Sistem
- **Node.js**: Versi 20.x atau lebih baru
- **NPM** atau Package Manager alternatif (pnpm, yarn)
- **Git**

### Langkah 1: Clone Repositori
```bash
git clone https://github.com/username/proyek-rpl-sistem-pelayanan-desa.git
cd proyek-rpl-sistem-pelayanan-desa
```

### Langkah 2: Instal Dependensi
Jalankan perintah berikut untuk mengunduh seluruh dependensi aplikasi:
```bash
npm install
```

### Langkah 3: Konfigurasi File Lingkungan (`.env`)
Salin berkas contoh konfigurasi `.env.example` menjadi `.env`:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**Linux / macOS:**
```bash
cp .env.example .env
```

Buka file `.env` dan sesuaikan nilainya jika diperlukan (secara *default* SQLite telah disiapkan):
```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="rahasia-kunci-sesi-anda-minimal-32-karakter"

# Kunci API AI (Contoh: Google / NVIDIA / OpenAI)
NVIDIA_API_KEY="kunci-api-anda"

# URL Dasar Aplikasi
APP_BASE_URL="http://localhost:3000"
```

### Langkah 4: Migrasi & Inisialisasi Database (Prisma SQLite)
Jalankan migrasi database dan pengisian data awal (*seeding* akun demo):
```bash
# Generate Prisma Client & Terapkan Migrasi
npx prisma migrate dev --name init

# Jalankan Seeding Akun & Data Master Layanan
npx prisma db seed
```

> **Akun Bawaan (Default Demo Credentials):**
> - **Admin**: `admin@desa.id` | Kata Sandi: `password123`
> - **Supervisor (Kepala Desa)**: `kades@desa.id` | Kata Sandi: `password123`
> - **Staf Pelayanan**: `staf@desa.id` | Kata Sandi: `password123`
> - **Warga 1**: `budi@gmail.com` | Kata Sandi: `password123`
> - **Warga 2**: `siti@gmail.com` | Kata Sandi: `password123`

### Langkah 5: Jalankan Server Pengembangan
```bash
npm run dev
```

Buka peramban (browser) dan akses alamat:
```
http://localhost:3000
```

---

## 🧰 Tumpukan Teknologi (Tech Stack)

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Bahasa**: [TypeScript](https://www.typescriptlang.org/)
- **ORM & Database**: [Prisma ORM](https://www.prisma.io/) dengan SQLite
- **AI SDK**: Vercel AI SDK (`ai`), Provider Google Gemini / NVIDIA / OpenAI
- **Autentikasi & Keamanan**: Jose (JWT), BcryptJS, HttpOnly Cookie Sessions
- **Notifikasi**: Nodemailer (Gmail) & WhatsApp API Gateway

---

## 📄 Lisensi & Hak Cipta
Proyek ini dikembangkan untuk keperluan akademik dan tugas Rekayasa Perangkat Lunak (RPL). Hak cipta dimiliki oleh tim **Cyber, Dev, Learning (DEVLYN)**.
