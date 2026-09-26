import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runProductPipeline } from '@/lib/pipeline';
import { callGemini } from '@/lib/gemini';
import { sendTelegramMessage } from '@/lib/telegram';

const EXTRACTOR_PROMPT = `
Anda adalah AI asisten bot yang cerdas dalam mengekstrak data produk Shopee dari pesan pengguna.
PESUNG BISA BERISI:
1. HANYA LINK (contoh: https://s.shopee.co.id/xxx)
2. TEKS LENGKAP DARI SHOPEE SHARE MESSAGE (judul produk, harga, dll + link)
3. CAMPAURAN Teks deskripsi + link

TUGAS ANDA:
1. Cari SEMUA URL yang mengandung "shopee.co.id" atau "shp.ee" di pesan.
2. Jika ada teks lain di sekitar link, CARIKAN JUDUL PRODUK & HARGA dari teks tersebut.
   - Format harga biasanya: "Rp 10.000", "Rp10.000", "10rb", "10.000"
   - Judul produk biasanya berada SEBELUM link (1-3 kalimat terakhir sebelum link)
3. Jika tidak menemukan nama/harga eksplisit, gunakan default:
   - name: "Produk Shopee Promo"
   - price: "Cek Promo"
4. Output HANYA dalam format JSON murni tanpa komentar tambahan.

Contoh Pesan dari Shopee Share Message:
"Cek ANGOLA Sikat Dorong Lantai D46 Alat Sikat Toilet Sikat Kamar Mandi Gagang Panjang 2IN1 dengan harga Rp24.800. Dapatkan di Shopee sekarang! https://s.shopee.co.id/3g3uO2XKGy?share_channel_code=2"

Dari contoh di atas, Anda harus ekstrak:
- name: "ANGOLA Sikat Dorong Lantai D46"
- price: "24.800"  
- affiliateUrl: "https://s.shopee.co.id/3g3uO2XKGy?share_channel_code=2"

Output JSON:
{
  "name": "Nama Produk Lengkap",
  "price": "100.000",
  "affiliateUrl": "https://s.shopee.co.id/xxx",
  "imageUrl": ""
}

Pesan Pengguna Saat Ini:
"{MESSAGE}"
`;

function extractJson(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    return cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdQuery = searchParams.get('userId');
    const update = await request.json();

    const msg = update.message;
    if (!msg) return NextResponse.json({ ok: true });

    // Dukung pesan teks maupun caption (jika share foto dari Shopee)
    const text = (msg.text || msg.caption || "").trim();
    if (!text) return NextResponse.json({ ok: true });

    const chatId = String(msg.chat.id);

    // Find user by userId in query OR by telegramChatId
    let settings = null;
    if (userIdQuery) {
      settings = await prisma.automationSettings.findUnique({ where: { userId: userIdQuery } });
    } else {
      settings = await prisma.automationSettings.findFirst({
        where: { telegramChatId: chatId, telegramEnabled: true }
      });
    }

    // Fallback: If still not found, check if there is an admin
    if (!settings) {
      settings = await prisma.automationSettings.findFirst({
        where: { telegramEnabled: true }
      });
    }
    
    if (!settings?.telegramBotToken || !settings.telegramEnabled) {
      return NextResponse.json({ ok: true, ignored: 'Bot disabled or no token' });
    }

    const token = settings.telegramBotToken;
    const targetUserId = settings.userId;

    // Save Chat ID if empty
    if (!settings.telegramChatId) {
      await prisma.automationSettings.update({
        where: { userId: targetUserId },
        data: { telegramChatId: chatId }
      });
    }

    if (text === '/start') {
      await sendTelegramMessage(token, chatId, "👋 *Halo Master!*\n\nBot siap menerima link Shopee. Bagikan (share) produk dari Shopee ke sini dan sistem akan otomatis memprosesnya.");
      return NextResponse.json({ ok: true });
    }

    if (text.includes("shopee.co.id") || text.includes("shp.ee")) {
      await sendTelegramMessage(token, chatId, "⏳ Sedang membedah produk dengan AI...");

      const prompt = EXTRACTOR_PROMPT.replace("{MESSAGE}", text);
      const extractedText = await callGemini(prompt);
      const parsed = JSON.parse(extractJson(extractedText));

      await sendTelegramMessage(token, chatId, `📦 *Produk Terdeteksi!*\nNama: ${parsed.name}\nHarga: Rp ${parsed.price}\n\n⚙️ Memasukkan ke Pipeline Engine...`);

      const product = await prisma.product.create({
        data: {
          userId: targetUserId,
          name: parsed.name,
          price: String(parsed.price),
          affiliateUrl: parsed.affiliateUrl,
          imageUrl: parsed.imageUrl || null,
        }
      });

      runProductPipeline(product.id, targetUserId).then(async (res) => {
        if (res.success && res.post) {
          const t = res.post.scheduledAt ? new Date(res.post.scheduledAt).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "-";
          await sendTelegramMessage(token, chatId, `✅ *Sukses Dijadwalkan!*\n⏰ Jam Tayang: *${t}*\n💬 Preview:\n_${res.post.hook}_`);
        } else {
          await sendTelegramMessage(token, chatId, `❌ *Pipeline Gagal:* ${res.reason}`);
        }
      });
    } else {
      await sendTelegramMessage(token, chatId, "Kirimkan link produk Shopee untuk diproses.");
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('[TELEGRAM WEBHOOK ERROR]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
