import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXTRACTOR_PROMPT = `
Kamu adalah AI asisten bot. Ekstrak data produk Shopee dari pesan Telegram pengguna di bawah ini.
Cari nama produk, estimasi harga, link affiliate/produk, dan link gambar jika ada.
Pesan Pengguna:
"{MESSAGE}"

Output HANYA dalam format JSON murni:
{
  "name": "Nama Produk Lengkap",
  "price": "100.000",
  "affiliateUrl": "https://s.shopee.co.id/xxx",
  "imageUrl": ""
}
`;

function extractJson(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    return cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const models = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash"];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (e) {
      // try next
    }
  }
  throw new Error("Semua model Gemini sedang sibuk/limit");
}

async function sendTelegram(token, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
    });
  } catch (err) {
    console.error("[-] Gagal kirim balasan Telegram:", err.message);
  }
}

async function run() {
  console.log("=========================================");
  console.log("🤖 TELEGRAM BOT RUNNER - THREADS ENGINE");
  console.log("=========================================\n");

  let offset = 0;

  while (true) {
    try {
      const settings = await prisma.automationSettings.findFirst({
        where: { telegramEnabled: true, telegramBotToken: { not: null } },
        orderBy: { updatedAt: "desc" }
      });

      if (!settings?.telegramBotToken || !settings.telegramEnabled) {
        console.log("[*] Bot Telegram belum diaktifkan atau token belum diisi di Settings. Menunggu 10 detik...");
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }

      const token = settings.telegramBotToken;
      const masterChatId = settings.telegramChatId;

      const pollUrl = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=20`;
      const res = await fetch(pollUrl);
      const data = await res.json();

      if (!data.ok) {
        console.error("[-] Telegram API error:", data.description);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      for (const update of data.result) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg) continue;

        // Ambil teks dari pesan biasa atau caption jika berbentuk media/gambar
        const text = (msg.text || msg.caption || "").trim();
        if (!text) continue;

        const chatId = String(msg.chat.id);
        const sender = msg.from?.first_name || "User";

        console.log(`[📩] Pesan masuk dari ${sender} (ID: ${chatId}): "${text.substring(0, 50)}..."`);

        const targetUserId = settings.userId;

        // Update chatId if empty
        if (!masterChatId) {
          await prisma.automationSettings.update({
            where: { userId: targetUserId },
            data: { telegramChatId: chatId }
          });
          console.log(`[+] Master Chat ID otomatis diset ke: ${chatId}`);
        }

        if (text === "/start") {
          await sendTelegram(
            token,
            chatId,
            `👋 *Halo Master ${sender}!*\n\nBot Telegram *Threads Affiliate Engine* aktif dan terhubung!\n\nMaster cukup *Share link produk Shopee* dari aplikasi Shopee ke chat ini. AI akan mengekstrak detailnya dan memasukkannya ke antrean posting secara otomatis! 🚀`
          );
          continue;
        }

        if (text.startsWith("/queue")) {
          const scheduled = await prisma.contentPost.findMany({
            where: { status: "SCHEDULED" },
            include: { product: true },
            orderBy: { scheduledAt: "asc" },
            take: 5
          });

          if (scheduled.length === 0) {
            await sendTelegram(token, chatId, "📭 *Antrean Kosong.*\nBelum ada jadwal posting berikutnya.");
          } else {
            let msg = `📅 *Antrean Konten Threads (${scheduled.length}):*\n\n`;
            scheduled.forEach((s, idx) => {
              const t = s.scheduledAt
                ? new Date(s.scheduledAt).toLocaleString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "short"
                  })
                : "-";
              msg += `${idx + 1}. *${s.product?.name?.substring(0, 30)}...*\n⏰ ${t}\n\n`;
            });
            await sendTelegram(token, chatId, msg);
          }
          continue;
        }

        if (text.startsWith("/status")) {
          const isPaused = !settings.enabled;
          await sendTelegram(
            token,
            chatId,
            `📊 *Status Engine:*\n- Otomasi: ${isPaused ? "⏸️ Jeda (Paused)" : "▶️ Aktif (Running)"}\n- Auto-Schedule: ${settings.autoSchedule ? "✅" : "❌"}\n- Auto-Publish: ${settings.autoPublish ? "✅" : "❌"}`
          );
          continue;
        }

        if (text.includes("shopee.co.id") || text.includes("shp.ee")) {
          await sendTelegram(token, chatId, "⏳ Sedang membedah produk dengan AI & OpenGraph Scraper...");

          try {
            // Extract URL from text
            const urlMatch = text.match(/https?:\/\/[^\s]+/);
            const targetUrl = urlMatch ? urlMatch[0] : text;

            let ogTitle = "";
            let ogDesc = "";
            let ogImage = "";

            try {
              const ogRes = await fetch(targetUrl, {
                headers: { "User-Agent": "TelegramBot (like TwitterBot)", Accept: "text/html" }
              });
              const html = await ogRes.text();
              const tm = html.match(/<meta property="og:title" content="([^"]+)">/i);
              const dm = html.match(/<meta property="og:description" content="([^"]+)">/i);
              const im = html.match(/<meta property="og:image" content="([^"]+)">/i);
              if (tm) ogTitle = tm[1];
              if (dm) ogDesc = dm[1];
              if (im) ogImage = im[1];
            } catch (e) {
              console.warn("Failed to fetch OG:", e.message);
            }

            const prompt = `
Anda adalah AI asisten bot yang cerdas mengekstrak data produk Shopee.
BACA PESAN PENGGUNA INI (pesan ini adalah teks asli yang dikirimkan user):

Pesan Pengguna: "${text}"
Metadata Title (dari URL Scraping): "${ogTitle}"
Metadata Deskripsi: "${ogDesc}"

TUGAS ANDA:
1. Cari JUDUL PRODUK dan HARGA dari teks Pesan Pengguna tersebut. Biasanya berformat "Cek [JUDUL PRODUK] dengan harga Rp[HARGA]".
2. Bersihkan judul dari kata pengantar berlebihan ("Cek", "Dapatkan di Shopee sekarang!").
3. Jika Pesan Pengguna hanya berupa link, gunakan Metadata Title & Deskripsi.
4. Output HANYA JSON murni!

Output JSON:
{
  "name": "Nama Produk Lengkap & Bersih",
  "price": "24.800 (tanpa Rp, hanya angka/titik)"
}
`;
            const extracted = await callGemini(prompt);
            const parsed = JSON.parse(extractJson(extracted));

            const finalName = parsed.name || ogTitle || "Produk Shopee";
            const finalPrice = parsed.price || "Cek Promo";
            const finalImage = ogImage || "";

            console.log(`[+] Produk terekstrak: "${finalName}" (Rp ${finalPrice})`);

            // Simpan produk ke DB dengan userId yang benar
            const product = await prisma.product.create({
              data: {
                userId: targetUserId,  // <-- Tambahkan ini
                name: finalName,
                price: String(finalPrice),
                affiliateUrl: targetUrl,
                imageUrl: finalImage || null
              }
            });

            await sendTelegram(
              token,
              chatId,
              `📦 *Produk Berhasil Di-ingest!*\n\n*Nama:* ${parsed.name}\n*Harga:* Rp ${parsed.price}\n\n⚙️ _Menjalankan AI Pipeline (Angle -> Content -> Schedule)..._`
            );

            // Trigger pipeline Next.js via internal fetch
            fetch("http://localhost:3000/api/pipeline", {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.CRON_SECRET || 'threads_affiliate_cron_secret_2026'}`
              },
              body: JSON.stringify({ productId: product.id })
            })
              .then(async (r) => {
                const pipeRes = await r.json();
                if (pipeRes.success && pipeRes.post) {
                  const t = pipeRes.post.scheduledAt
                    ? new Date(pipeRes.post.scheduledAt).toLocaleString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "short"
                      })
                    : "-";
                  await sendTelegram(
                    token,
                    chatId,
                    `✅ *Konten Berhasil Dijadwalkan!*\n\n⏰ *Jadwal Tayang:* ${t}\n\n💬 *Preview Hook:*\n"${pipeRes.post.hook}"`
                  );
                } else {
                  await sendTelegram(
                    token,
                    chatId,
                    `⚠️ Pipeline selesai tapi ada catatan: ${pipeRes.reason || "Cek antrean di web"}`
                  );
                }
              })
              .catch((err) => console.error("[-] Error trigger pipeline:", err.message));
          } catch (err) {
            console.error("[-] Gagal ekstrak produk:", err);
            await sendTelegram(token, chatId, `❌ Gagal memproses link: ${err.message}`);
          }
          continue;
        }

        await sendTelegram(token, chatId, "🤖 Kirimkan link Shopee atau teks share dari Shopee untuk diproses otomatis.");
      }
    } catch (err) {
      console.error("[-] Polling loop error:", err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

run();
