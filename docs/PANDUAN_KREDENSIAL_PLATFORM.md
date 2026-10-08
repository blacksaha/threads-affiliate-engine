# 📖 Panduan Lengkap Kredensial Multi-Platform (Threads Affiliate Content Engine)

Panduan praktis langkah demi langkah untuk mendapatkan kredensial API dan menghubungkannya ke aplikasi **Threads Affiliate Content Engine**.

---

## 1. 🧵 Meta Threads API (User ID & Access Token)

Meta Threads menggunakan **Meta for Developers** (Graph API / Threads API).

### Langkah Mendapatkan:
1. **Buka Portal Pengembang Meta**:
   * Kunjungi [https://developers.facebook.com](https://developers.facebook.com) dan login dengan akun Facebook/Instagram yang terhubung dengan akun Threads Anda.
2. **Buat Aplikasi Baru**:
   * Klik **My Apps** → **Create App**.
   * Pilih tipe use case: **Other** → pilih tipe **Business** (atau **Consumer**).
   * Beri nama aplikasi (contoh: `Affiliate Threads Bot`), lalu klik **Create App**.
3. **Tambahkan Produk Threads**:
   * Di dashboard aplikasi, scroll ke bawah ke bagian **Add a product**.
   * Cari produk **Threads API**, lalu klik **Set Up**.
4. **Dapatkan Token & User ID via Graph API Explorer**:
   * Di menu navigasi atas/kiri, buka **Tools** → **Graph API Explorer**.
   * Di panel kanan (Meta App), pilih aplikasi yang baru saja Anda buat.
   * Di kolom **User or Page**, pilih User Token / Threads User.
   * Di bagian **Permissions**, tambahkan izin berikut:
     * `threads_basic`
     * `threads_content_publish`
     * `threads_read_replies` (opsional untuk reply/analytics)
   * Klik **Generate Access Token**. Lakukan login & setujui verifikasi akun Threads Anda.
   * **Ambil User ID**: Jalankan query `GET me?fields=id,username` di Graph API Explorer. Angka `id` yang keluar adalah **Threads User ID**.
5. **Ubah Jadi Long-Lived Token (Agar Berlaku 60 Hari)**:
   * Buka **Access Token Tool** di Meta Developers atau lakukan curl pertukaran token:
     ```bash
     GET https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret={THREADS_APP_SECRET}&access_token={SHORT_LIVED_TOKEN}
     ```
   * Salin token panjang yang dihasilkan.
6. **Simpan ke Aplikasi**:
   * Masuk ke dashboard web di menu **Settings** (`/settings`) atau **Social Accounts**.
   * Masukkan **User ID** dan **Access Token** Threads.

---

## 2. 🤖 Telegram Mobile Ingest Bot (Bot Token & Chat ID)

Bot ini berfungsi sebagai pusat kontrol mobile: kirim link Shopee/TikTok Shop langsung dari HP via Telegram untuk dijadwalkan otomatis.

### Langkah Membuat Bot:
1. **Buka Telegram** dan cari akun resmi **`@BotFather`** (dengan centang biru).
2. Kirim perintah:
   ```text
   /newbot
   ```
3. Beri nama bot (contoh: `Affiliate Ingest Bot`).
4. Beri username bot yang berakhiran `bot` (contoh: `cuan_affiliate_engine_bot`).
5. **BotFather akan memberikan HTTP API Token**:
   * Contoh: `7123456789:AAFlkjhsdf89sd7f98sd7f...`
   * Salin kode token ini sebagai `TELEGRAM_BOT_TOKEN`.

### Mendapatkan Chat ID Pribadi Anda:
1. Cari akun **`@userinfobot`** di Telegram.
2. Klik **Start**.
3. Bot akan membalas dengan menampilkan angka `Id` Anda (contoh: `123456789`).
4. Angka ini adalah `TELEGRAM_ALLOWED_USER_ID` (agar hanya akun Telegram Anda yang bisa memberi perintah).

### Memasang Webhook ke Aplikasi:
Jalankan URL berikut di browser Anda (ganti dengan token dan URL Vercel Anda):
```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://threads-affiliate-engine.vercel.app/api/telegram/webhook
```
Jika muncul `{"ok":true,"result":true,"description":"Webhook was set"}`, bot Telegram sudah aktif 100%!

---

## 3. 📘 Facebook Page (Page ID & Page Access Token)

Digunakan untuk otomatisasi posting ke Halaman Facebook (Status + link otomatis ditaruh di komentar pertama).

### Langkah Mendapatkan:
1. **Buat / Pastikan Anda Memiliki Facebook Page**:
   * Buat Page publik di akun Facebook Anda (misal: `Rekomendasi Racun Shopee`).
2. **Dapatkan Page ID**:
   * Buka Page Anda di Facebook → Klik tab **About** / **Tentang** → **Page Transparency** (atau lihat URL profil halaman).
   * Page ID adalah sederet angka (contoh: `102938475610293`).
3. **Dapatkan Page Access Token (Never-Expiring Token)**:
   * Buka [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/).
   * Pada dropdown **User or Page**, pilih Halaman (Page) Anda.
   * Pada bagian permissions, pastikan tercentang:
     * `pages_show_list`
     * `pages_read_engagement`
     * `pages_manage_posts`
     * `pages_read_user_content`
   * Klik **Generate Access Token** dan setujui izin untuk Page tersebut.
   * Lakukan query untuk melihat Page Token permanen:
     ```text
     GET me?fields=access_token,id,name
     ```
   * Salin `access_token` yang muncul. Token Page ini bersifat permanen (tidak akan kadaluarsa selama password akun FB tidak diganti).
4. **Simpan ke Aplikasi**:
   * Masukkan **Page ID** dan **Page Access Token** di menu Settings aplikasi.

---

## 4. 🐦 X / Twitter API (OAuth 2.0 User Context)

Engine kita menggunakan **OAuth 2.0 User Context** (Authorization Code with PKCE / Refresh Token), yang stabil dan tidak terkena blokir invalid client.

### Langkah Mendapatkan:
1. **Buka X Developer Portal**:
   * Kunjungi [https://developer.x.com/en/portal/dashboard](https://developer.x.com/en/portal/dashboard).
   * Login dengan akun X Anda dan pastikan terdaftar paket **Free** (cukup untuk 1.500 postingan/bulan).
2. **Buat Project & App**:
   * Buat Project baru, lalu buat App di dalamnya.
3. **Atur User Authentication Settings**:
   * Buka tab **Settings** pada App Anda di Developer Portal.
   * Scroll ke bagian **User authentication settings** lalu klik **Set up** (atau Edit).
   * Atur:
     * **App permissions**: Pilih `Read and write`.
     * **Type of App**: Pilih `Web App, Automated App or Bot`.
     * **App info**:
       * Callback URI / Redirect URL: Masukkan `https://threads-affiliate-engine.vercel.app/api/auth/twitter/callback` (atau `http://localhost:3000/callback`).
       * Website URL: `https://threads-affiliate-engine.vercel.app`.
   * Klik **Save**.
4. **Ambil Kredensial OAuth 2.0**:
   * Buka tab **Keys and tokens** pada App Anda.
   * Cari bagian **OAuth 2.0 Keys**:
     * Salin **Client ID** (contoh: `bWotV2hkYVBDRFh1c2V6...`).
     * Salin **Client Secret** (pastikan disimpan karena hanya muncul sekali).
5. **Hubungkan Token Akun X ke Aplikasi**:
   * Masukkan `TWITTER_CLIENT_ID` dan `TWITTER_CLIENT_SECRET` ke Environment Variables Vercel.
   * Lakukan integrasi atau refresh token via aplikasi agar database menyimpan `accessToken` dan `refreshToken` akun X Anda.
   * Engine akan secara otomatis me-refresh token X setiap kali akan memposting konten baru tanpa perlu login manual lagi.

---

## 💡 Rangkuman Lokasi Pengisian di Aplikasi:
* **Web Dashboard**: Buka [https://threads-affiliate-engine.vercel.app/settings](https://threads-affiliate-engine.vercel.app/settings)
* **Vercel Project Settings**: [Vercel Dashboard → Settings → Environment Variables](https://vercel.com)
