# THREADS AFFILIATE CONTENT ENGINE

Sistem manajemen dan otomasi konten affiliate untuk **Meta Threads** berbasis AI dengan prinsip **Hands-Off Full Automation** (*Generate → Validate → Schedule → Publish → Analyze → Optimize*).

---

## 🌟 Fitur Utama

1. **Autonomous Content Pipeline**:
   - Analisis produk otomatis & penentuan *Content Angle* unik.
   - Pembuatan 4 naskah rantai utas bersambung (*Hook* → *Story* → *Review* → *CTA/Link*).
   - Validasi kemiripan otomatis (*Anti-Repetition Check*) dengan 10 konten terdahulu.
   - Pemeriksaan kelayakan naskah (*Automated Quality Check*) sebelum penjadwalan.
   - Otomatis *regenerate* hingga 3 kali jika konten dinilai repetitif atau kaku.

2. **Auto-Scheduling Engine**:
   - Penentuan jadwal tayang otomatis berdasarkan interval posting, preferensi jam, dan rotasi produk.
   - Tanpa tombol *manual approval* — konten yang lolos validasi langsung berstatus **SCHEDULED**.

3. **Multi-layer Meta Threads Publisher**:
   - Publikasi resmi via Threads Graph API (Container creation → Media render wait → Publish).
   - Penempatan foto produk otomatis di *Post 3* untuk memaksimalkan retensi pembaca.
   - Pengunci tugas (*Idempotency Lock*) dan *limited retry* (maksimal 3 kali).

4. **Analytics Engine & AI Optimization (Feedback Loop)**:
   - Pengumpulan data impresi, likes, replies, reposts dari Threads Insights API.
   - Deteksi otomatis konten viral (*Top Performer*).
   - AI mempelajari pola kalimat dari postingan berkinerja tinggi sebagai referensi naskah berikutnya.

5. **Safety Controls**:
   - Tombol **PAUSE / RESUME AUTOMATION** instan di pojok sidebar dan dashboard.
   - Activity logs transparan mencatat setiap keputusan pipeline dan panggilan API.

---

## 🏗️ Struktur Arsitektur & Teknologi

- **Framework**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Database**: SQLite (Development) / PostgreSQL (Production) via Prisma ORM
- **AI Engine**: Google Gemini API via Direct REST (model fallback: `gemini-flash-latest`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`)
- **Background Runner**: 
  - Lokal: Node.js Instrumentation Daemon (`src/instrumentation.ts`)
  - Cloud: Vercel Cron Jobs (`vercel.json`)

---

## 🚀 Panduan Menjalankan Aplikasi

### 1. Konfigurasi Environment Variables (`.env`)
Pastikan file `.env` sudah terisi:
```env
DATABASE_URL="file:./prisma/dev.db"
GEMINI_API_KEY="AIzaSy..."
THREADS_USER_ID="28345423238482705"
THREADS_ACCESS_TOKEN="THAAPsAS..."
CRON_SECRET="threads_affiliate_cron_secret_2026"
```

### 2. Migrasi Database
```bash
npx prisma db push
npx prisma generate
```

### 3. Menjalankan Server Development
```bash
npm run dev
```
Akses di browser: `http://localhost:3000`

---

## 🧭 Navigasi Menu

| Menu | Path | Deskripsi |
| :--- | :--- | :--- |
| **Dashboard** | `/` | KPI metrics, input produk cepat, dan status automasi |
| **Database Produk** | `/products` | Katalog produk Shopee & generator variasi utas |
| **Content Queue** | `/queue` | Antrean konten, visualisasi 4 draft rantai, edit/cancel/publish now |
| **Content Calendar** | `/calendar` | Tampilan kalender jadwal tayang otomatis |
| **Analytics & AI Loop** | `/analytics` | Evaluasi performa threads dan status feedback loop AI |
| **Activity Logs** | `/logs` | Rekam jejak aktivitas sistem secara rinci |
| **Automation Settings** | `/settings` | Pengaturan frekuensi, interval, dan token Threads |

---

## ⚡ Deployment ke Vercel

1. Push repository ke GitHub.
2. Hubungkan ke Vercel.
3. Tambahkan environment variables di dashboard Vercel (`GEMINI_API_KEY`, `THREADS_USER_ID`, `THREADS_ACCESS_TOKEN`, dll.).
4. Vercel Cron otomatis memicu scheduler tiap 10 menit (`/api/cron/scheduler`) dan sinkronisasi analitik tiap 2 jam (`/api/cron/analytics`).
