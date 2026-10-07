import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runProductPipeline } from '@/lib/pipeline';
import { callGemini } from '@/lib/gemini';
import { sendTelegramMessage } from '@/lib/telegram';
import { scrapeShopeePage } from '@/lib/shopee';

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
   - Jika ada URL gambar produk di pesan (biasanya berisi .jpg/.png/.webp), ekstrak juga ke imageUrl. Jika tidak ada, biarkan kosong.
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

/**
 * Regex-only extraction, used when the LLM is unavailable (429/503/outage).
 *
 * A Shopee share message is highly regular ("<judul> dengan harga Rp24.800.
 * Dapatkan di Shopee sekarang! <link>"), so the link, price and title can all
 * be recovered without an AI call. Without this, a transient Gemini failure
 * means the product is never created and the user's link is lost for good.
 */
function parseShopeeMessageFallback(text: string) {
  const urlMatch = text.match(/https?:\/\/(?:s\.shopee\.co\.id|shp\.ee)\/[^\s]+/i);
  const affiliateUrl = urlMatch ? urlMatch[0] : "";

  // "Rp24.800" / "Rp 24.800" / "24.800" / "Rp24,800"
  const priceMatch = text.match(/rp\s*([\d.,]+)/i) || text.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/);
  const price = priceMatch ? priceMatch[1].replace(/[.,]/g, "") : "Cek Promo";

  // Title = the text just before the link, with Shopee boilerplate stripped.
  let name = "Produk Shopee Promo";
  const beforeLink = affiliateUrl ? text.split(affiliateUrl)[0] : text;
  const cleaned = beforeLink
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/cek\s+/i, " ")
    .replace(/dengan harga[\s\S]*$/i, " ")
    .replace(/dapatkan di shopee sekarang!?/i, " ")
    .replace(/rp\s*[\d.,]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length > 3) {
    name = cleaned.length > 120 ? cleaned.slice(0, 120).trim() : cleaned;
  }

  const imageMatch = text.match(/https?:\/\/\S+\.(?:jpg|jpeg|png|webp)(?:\?\S*)?/i);

  return { name, price, affiliateUrl, imageUrl: imageMatch ? imageMatch[0] : "" };
}

export const maxDuration = 60; // Allow 60s for Telegram webhook + AI Generation

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
      // DEDUPLIKASI: Cek apakah link ini sudah pernah dikirim dalam 15 menit terakhir
      // Menggunakan regex untuk mencari link shopee di dalam teks
      const urlMatch = text.match(/https?:\/\/(?:s\.shopee\.co\.id|shp\.ee)\/[^\s]+/i);
      if (urlMatch) {
        const urlToMatch = urlMatch[0];
        // Kita cari product dengan affiliateUrl yang mengandung ID pendek link tersebut,
        // yang dibuat dalam 15 menit terakhir
        const urlCode = urlToMatch.split('/').pop()?.split('?')[0]; // ambil kode uniknya (misal 5fp5orbQWs)
        
        if (urlCode) {
          const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
          const existingRecent = await prisma.product.findFirst({
            where: {
              userId: targetUserId,
              affiliateUrl: { contains: urlCode },
              createdAt: { gte: fifteenMinsAgo }
            }
          });

          if (existingRecent) {
            console.log(`[WEBHOOK] Duplicate detected for ${urlCode}. Ignoring to prevent Telegram retry loops.`);
            // Langsung respon OK agar Telegram berhenti mengulang (retry) pesan ini
            return NextResponse.json({ ok: true, duplicate: true });
          }
        }
      }

      await sendTelegramMessage(token, chatId, "⏳ Sedang membedah produk dengan AI...");

      try {
        const settings = await prisma.automationSettings.findUnique({
          where: { userId: targetUserId }
        });
        const aiConfig = {
          provider: settings?.aiProvider || "GEMINI",
          apiKey: settings?.aiApiKey || null,
        };

        const prompt = EXTRACTOR_PROMPT.replace("{MESSAGE}", text);
        // Hard 20s ceiling: the webhook must stay well inside maxDuration=60 and
        // the regex fallback below is fast and reliable.
        const extractedText = await callGemini(prompt, { deadlineMs: 20000, ...aiConfig });
        const parsed = JSON.parse(extractJson(extractedText));

        await sendTelegramMessage(token, chatId, `📦 *Produk Terdeteksi!*\nNama: ${parsed.name}\nHarga: Rp ${parsed.price}\n\n⚙️ Memasukkan ke Pipeline Engine...`);

        // Ambil gambar produk langsung dari halaman Shopee agar postingan FB punya foto
        let finalImageUrl: string | null = parsed.imageUrl || null;
        if (!finalImageUrl && parsed.affiliateUrl) {
          try {
            const scraped = await scrapeShopeePage(parsed.affiliateUrl);
            if (scraped.imageUrl) {
              finalImageUrl = scraped.imageUrl;
              console.log(`[WEBHOOK] Image URL found: ${finalImageUrl}`);
            }
          } catch (e) {
            console.warn('[WEBHOOK] Image scrape failed:', e);
          }
        }

        const product = await prisma.product.create({
          data: {
            userId: targetUserId,
            name: parsed.name,
            price: String(parsed.price),
            affiliateUrl: parsed.affiliateUrl,
            imageUrl: finalImageUrl,
          }
        });

        // Hapus pemanggilan runProductPipeline dari webhook agar webhook merespon sangat cepat (1 detik).
        // Pipeline AI yang berat (Gemini, dll) akan otomatis ditangkap dan dieksekusi oleh Cron Job 10-menit.
        await sendTelegramMessage(token, chatId, `✅ *Produk Masuk Antrean!*\nNama: ${parsed.name}\nHarga: Rp ${parsed.price}\n\nSistem akan merancang utas dan menjadwalkannya secara otomatis dalam beberapa menit ke depan.`);

      } catch (err: any) {
        console.error('[WEBHOOK AI ERROR]', err);
        // Gemini is rate-limited/saturated far too often to accept silently.
        // Fallback to deterministic extraction so the user's link is never lost.
        const fallback = parseShopeeMessageFallback(text);
        if (!fallback.affiliateUrl) {
          await sendTelegramMessage(token, chatId, `❌ *Terjadi Kesalahan Server:* ${err.message}`);
          return NextResponse.json({ ok: true, error: err.message });
        }

        console.warn(`[WEBHOOK] Falling back to regex extraction. Reason: ${err.message}`);
        await sendTelegramMessage(
          token,
          chatId,
          `⚠️ *AI sibuk sekarang (429).* Saya tetap menyimpan produk ini lewat ekstraksi manual dan akan diproses otomatis.\nNama: ${fallback.name}\nHarga: Rp ${fallback.price}`
        );

        let finalImageUrl: string | null = fallback.imageUrl || null;
        if (!finalImageUrl) {
          try {
            const scraped = await scrapeShopeePage(fallback.affiliateUrl);
            finalImageUrl = scraped.imageUrl || null;
          } catch (e) {
            console.warn('[WEBHOOK] Fallback image scrape failed:', e);
          }
        }

        await prisma.product.create({
          data: {
            userId: targetUserId,
            name: fallback.name,
            price: String(fallback.price),
            affiliateUrl: fallback.affiliateUrl,
            imageUrl: finalImageUrl,
          }
        });
        // Pipeline cron akan menangani generation nanti, seperti produk normal.
      }
    } else {
      await sendTelegramMessage(token, chatId, "Kirimkan link produk Shopee untuk diproses.");
    }

    // Response cepat ke Telegram
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('[TELEGRAM WEBHOOK ERROR]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
