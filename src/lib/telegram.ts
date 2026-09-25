import { prisma } from './prisma';
import { runProductPipeline } from './pipeline';
import { callGemini } from './gemini';

// Extractor Prompt for Gemini
const EXTRACTOR_PROMPT = `
Kamu adalah AI asisten bot. Ekstrak data produk Shopee dari pesan Telegram pengguna di bawah ini.
Jika teks hanya berisi link tanpa nama/harga, coba berikan nama default seperti "Produk Shopee Promo" dan harga "Harga Diskon".

Pesan Pengguna:
"{MESSAGE}"

Output HANYA dalam format JSON murni:
{
  "name": "Nama Produk",
  "price": "100.000",
  "affiliateUrl": "https://s.shopee.co.id/xxx",
  "imageUrl": "https://image.url/xxx" // kosongkan string jika tidak ada link gambar
}
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

export async function sendTelegramMessage(token: string, chatId: string, text: string) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('[TELEGRAM] Error sending message:', err);
  }
}

let isPolling = false;

export async function startTelegramDaemon() {
  if (isPolling) return;
  isPolling = true;

  console.log('[TELEGRAM DAEMON] Starting long-polling...');
  let offset = 0;

  // Polling Loop
  while (true) {
    try {
      const settings = await prisma.automationSettings.findFirst({
        where: { userId: 'default_user' },
      });

      if (!settings?.telegramBotToken || !settings?.telegramEnabled) {
        // Wait 15 seconds if disabled/missing token
        await new Promise((res) => setTimeout(res, 15000));
        continue;
      }

      const token = settings.telegramBotToken;
      // We accept messages from any chat if master hasn't set one, or only from master
      const masterChatId = settings.telegramChatId || '';

      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=30`;
      const res = await fetch(url);
      
      if (!res.ok) {
        // Probably bad token
        await new Promise((res) => setTimeout(res, 10000));
        continue;
      }

      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1; // Move offset

          if (!update.message || !update.message.text) continue;
          
          const text = update.message.text.trim();
          const chatId = String(update.message.chat.id);

          // Security check: If masterChatId is set, block strangers
          if (masterChatId && masterChatId !== chatId) {
            await sendTelegramMessage(token, chatId, "Maaf, Anda bukan Master saya. Akses ditolak.");
            continue;
          }

          console.log(`[TELEGRAM] Received from ${chatId}: ${text}`);

          // --- COMMAND PROCESSING ---
          if (text === '/start') {
            const reply = "👋 *Halo Master!*\n\nBot Affiliate Content Engine siap bertugas.\n\nKirimkan share link dari Shopee app ke sini (lengkap dengan teksnya atau link saja), dan saya akan mengurus sisanya!\n\nPerintah tersedia:\n`/status` - Cek status engine\n`/queue` - Cek antrean 3 konten terdekat\n`/pause` - Hentikan automasi\n`/resume` - Aktifkan automasi";
            await sendTelegramMessage(token, chatId, reply);
          } 
          else if (text === '/status') {
            const masterSettings = await prisma.automationSettings.findUnique({ where: { userId: 'default_user' } });
            const queueCount = await prisma.contentPost.count({ where: { status: 'SCHEDULED' } });
            const reply = `📊 *STATUS ENGINE*\n\nAutomasi: ${masterSettings?.enabled ? '🟢 ACTIVE' : '🔴 PAUSED'}\nAntrean Scheduled: *${queueCount}* post\n\n_Engine siap menerima input produk baru._`;
            await sendTelegramMessage(token, chatId, reply);
          }
          else if (text === '/queue') {
            const posts = await prisma.contentPost.findMany({
              where: { status: 'SCHEDULED' },
              orderBy: { scheduledAt: 'asc' },
              take: 3,
              include: { product: true }
            });
            if (posts.length === 0) {
              await sendTelegramMessage(token, chatId, "📭 Antrean Scheduled sedang kosong.");
            } else {
              let reply = "⏳ *3 Antrean Konten Berikutnya:*\n\n";
              posts.forEach((p, i) => {
                const timeStr = p.scheduledAt ? new Date(p.scheduledAt).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "-";
                reply += `${i+1}. *${p.product.name}*\n⏰ Jadwal: ${timeStr}\n\n`;
              });
              await sendTelegramMessage(token, chatId, reply);
            }
          }
          else if (text === '/pause') {
            await prisma.automationSettings.update({ where: { userId: 'default_user' }, data: { enabled: false } });
            await sendTelegramMessage(token, chatId, "🔴 Automasi sistem berhasil dihentikan (PAUSED).");
          }
          else if (text === '/resume') {
            await prisma.automationSettings.update({ where: { userId: 'default_user' }, data: { enabled: true } });
            await sendTelegramMessage(token, chatId, "🟢 Automasi sistem berhasil diaktifkan (ACTIVE).");
          }
          else {
            // --- INGEST PRODUK SHOPEE ---
            if (text.includes("shopee.co.id") || text.includes("shp.ee")) {
              await sendTelegramMessage(token, chatId, "⏳ Menganalisis produk dari pesan Master menggunakan AI...");
              
              try {
                // 1. Ekstrak data via Gemini
                const prompt = EXTRACTOR_PROMPT.replace("{MESSAGE}", text);
                const extractedText = await callGemini(prompt);
                const parsed = JSON.parse(extractJson(extractedText));

                if (!parsed.name || !parsed.affiliateUrl) {
                  throw new Error("Gagal mengekstrak nama atau link affiliate.");
                }

                // Jika master belum set Chat ID, set otomatis ke Chat ID pertama yang ngirim link
                if (!masterChatId) {
                  await prisma.automationSettings.update({
                    where: { userId: 'default_user' },
                    data: { telegramChatId: chatId }
                  });
                }

                await sendTelegramMessage(token, chatId, `📦 *Produk Terdeteksi!*\nNama: ${parsed.name}\nHarga: Rp ${parsed.price}\n\n⚙️ Memasukkan ke Pipeline Engine...`);

                // 2. Masukkan Database & Jalankan Pipeline
                const product = await prisma.product.create({
                  data: {
                    name: parsed.name,
                    price: String(parsed.price),
                    affiliateUrl: parsed.affiliateUrl,
                    imageUrl: parsed.imageUrl || null,
                  }
                });

                await prisma.systemLog.create({
                  data: {
                    level: 'INFO',
                    source: 'TELEGRAM_BOT',
                    message: `Produk "${product.name}" diinput via Telegram oleh chat_id: ${chatId}`,
                  }
                });

                // Menjalankan pipeline tanpa await yang nge-block loop
                runProductPipeline(product.id, "default_user").then(async (res) => {
                  if (res.success && res.post) {
                    const t = res.post.scheduledAt ? new Date(res.post.scheduledAt).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "Tidak Diketahui";
                    await sendTelegramMessage(token, chatId, `✅ *Konten Berhasil Disusun & Dijadwalkan!*\n\n⏰ Tayang pada: *${t}*\n🎯 Angle: *${res.post.qualityScore?.toFixed(2)} Score*\n\n💬 Preview Hook:\n_${res.post.hook}_\n\nSistem berjalan normal. Tancap produk selanjutnya!`);
                  } else {
                    await sendTelegramMessage(token, chatId, `❌ *Pipeline Gagal*\nAlasan: ${res.reason || "Kualitas/Repetisi tidak memenuhi standar."}`);
                  }
                }).catch(async (e) => {
                  await sendTelegramMessage(token, chatId, `❌ *Pipeline Error*\n${String(e)}`);
                });

              } catch (err) {
                await sendTelegramMessage(token, chatId, "❌ Maaf Master, AI gagal membedah pesan/link tersebut. Pastikan teksnya jelas atau coba lagi.");
                console.error("[TELEGRAM] Extraction Error:", err);
              }
            } else {
              await sendTelegramMessage(token, chatId, "🤔 Pesan tidak mengandung link Shopee. Kirim link produk atau ketik /help.");
            }
          }
        }
      }

    } catch (err) {
      console.error('[TELEGRAM DAEMON] Polling error:', err);
      // Wait before reconnecting on error
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
}
