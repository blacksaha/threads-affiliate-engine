import { prisma } from './prisma';

// Mengambil dan memisahkan multi-API Key
const GEMINI_API_KEYS = (process.env.GEMINI_API_KEY || "").split(',').map(k => k.trim()).filter(k => k.length > 0);
// Acak index awal agar beban terbagi merata sejak awal di serverless
let currentKeyIndex = GEMINI_API_KEYS.length > 0 ? Math.floor(Math.random() * GEMINI_API_KEYS.length) : 0;

function getNextApiKey() {
  if (GEMINI_API_KEYS.length === 0) return null;
  const key = GEMINI_API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
  return key;
}

// Fallback models in order of priority (Hanya model valid yang aktif)
const CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];

const HOOK_ARCHETYPES = [
  "Relatable Venting (Curhat masalah harian/anak kost/kantoran yang bikin jengkel secara jujur)",
  "Curious Discovery (Pengakuan nemu barang random yang ternyata mengubah rutinitas)",
  "Myth Buster / Anti-Mainstream (Membantah anggapan barang mahal harus beli yang jutaan padahal ada alternatif praktis)",
  "Plot Twist / Humorous (Awalnya skeptis dan ngeremehin, pas datang malah ketagihan)",
  "Social Proof / FOMO Halus (Cerita gara-gara racun teman atau lewat di FYP terus nyobain sendiri)"
];

export interface ThreadPostDraft {
  hook: string;
  story: string;
  review: string;
  cta: string;
  chain: string[];
  xContent?: string;
  fbContent?: string;
  fbComment?: string;
}

export interface ValidationResult {
  pass: boolean;
  score: number;
  reason?: string;
}

function extractJson(text: string): string {
  let cleaned = text.trim();
  // Remove markdown fences
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  
  // Try to find the outermost JSON array or object
  const firstBracket = cleaned.indexOf("[");
  const firstBrace = cleaned.indexOf("{");

  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    const lastBracket = cleaned.lastIndexOf("]");
    if (lastBracket !== -1) {
      return cleaned.substring(firstBracket, lastBracket + 1);
    }
  } else if (firstBrace !== -1) {
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1) {
      return cleaned.substring(firstBrace, lastBrace + 1);
    }
  }

  return cleaned;
}

export async function callGemini(prompt: string): Promise<string> {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  let lastError: unknown = null;

  for (const model of CANDIDATE_MODELS) {
    // Coba SEMUA API Key yang tersedia (rotasi penuh) sebelum berpindah model
    for (let keyAttempt = 0; keyAttempt < GEMINI_API_KEYS.length; keyAttempt++) {
      const apiKey = getNextApiKey();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 40000);

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
          signal: controller.signal,
        });

        if (response.status === 503) {
          console.warn(`[GEMINI] Model ${model} is experiencing high demand (503). Trying fallback model...`);
          lastError = "Server overloaded (503)";
          break; // Break the key attempt loop, try next model
        }

        if (response.status === 429 || response.status === 403 || response.status === 400) {
          console.warn(`[GEMINI] Model ${model} returned ${response.status} on key. Rotating to next API Key...`);
          lastError = `Status ${response.status} on key - Switching Key`;
          continue; // Langsung coba key berikutnya!
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`[GEMINI] Model ${model} returned error ${response.status}: ${errorText}`);
          lastError = `HTTP ${response.status} - ${errorText.substring(0, 100)}`;
          break; // Break the key attempt loop, try next model
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawText.trim()) {
          clearTimeout(timeoutId);
          return rawText.trim();
        }
      } catch (err: unknown) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        console.warn(`[GEMINI] Attempt with model ${model} failed${isAbort ? " (timeout)" : ""}:`, err);
        lastError = err;
        // Jeda sangat singkat jika error network
        await new Promise((r) => setTimeout(r, 1000));
        break; // Break key loop, try next model
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${String(lastError)}`);
}

/**
 * 1. Product Analysis & Content Angles
 */
export async function generateProductAngles(productName: string, price: string, description?: string) {
  // Query top performing angles for context
  const topAngles = await prisma.contentAngle.findMany({
    where: { posts: { some: { analytics: { isTopPerformer: true } } } },
    take: 3,
    select: { angleType: true, description: true }
  });

  const contextStr = topAngles.length > 0 
    ? `\nSebagai referensi, ini adalah beberapa angle yang terbukti sukses (engagement tinggi) di masa lalu:\n${topAngles.map(a => `- ${a.angleType}: ${a.description}`).join('\n')}`
    : "";

  const prompt = `
Analisis produk affiliate ini dan berikan 3 content angle unik untuk Threads:
Nama Produk: ${productName}
Harga: ${price}
Deskripsi: ${description || "Produk populer di Shopee"}${contextStr}

Format output HANYA JSON array murni:
[
  {
    "angleType": "Problem Solver",
    "description": "Fokus pada keluhan sehari-hari yang bikin repot",
    "targetAudience": "Anak kost / pekerja kantoran"
  }
]
`;
  try {
    const result = await callGemini(prompt);
    const clean = extractJson(result);
    return JSON.parse(clean);
  } catch (err) {
    console.warn("[GEMINI] Falling back to default angles due to parse/call error:", err);
    return [
      { angleType: "Problem Solver", description: "Mengatasi masalah harian secara praktis", targetAudience: "Umum" },
      { angleType: "Curious Discovery", description: "Nemu barang unik dengan harga terjangkau", targetAudience: "Netizen pecinta diskon" },
      { angleType: "Before After", description: "Transformasi kenyamanan setelah memakai produk", targetAudience: "Pengguna aktif" },
    ];
  }
}

/**
 * 2. Generate Thread Chain (Hook -> Story -> Review -> CTA)
 */
export async function generateThreadContent(
  productName: string,
  price: string,
  affiliateUrl: string,
  angleType: string,
  angleDesc: string,
  previousHooks: string[] = []
): Promise<ThreadPostDraft> {
  // Query top performing hooks for learning
  const topHooks = await prisma.contentPost.findMany({
    where: { analytics: { isTopPerformer: true } },
    take: 2,
    select: { hook: true }
  });

  const learnedInsights = topHooks.length > 0 
    ? `\nSebagai acuan gaya, berikut adalah contoh hook yang sebelumnya mendapatkan interaksi tinggi:\n${topHooks.map(h => `- "${h.hook}"`).join('\n')}\nGunakan esensi pemicu rasa penasaran yang serupa tapi tetap segar!`
    : "";

  const antiRepetitionRule = previousHooks.length > 0 
    ? `\n5. ANTI-REPETISI SANGAT PENTING: DILARANG KERAS menggunakan pola kalimat, ide cerita, atau hook yang mirip dengan daftar postingan sebelumnya ini:\n${previousHooks.map(h => `- "${h}"`).join('\n')}\nCiptakan sudut pandang yang 100% baru dan berbeda dari daftar di atas!`
    : "";

  const prompt = `
Bantu saya menjadi seorang konten kreator profesional di Threads yang natural, elegan, dan organik (BUKAN BOT SPAM IKLAN).
Tugasmu adalah membuat draft postingan bersambung tentang produk affiliate:
Nama Produk: ${productName}
Harga: ${price}
Link: ${affiliateUrl}

Instruksi Kreatif & Gaya Bahasa (ARSITEKTUR 2-STEP COMPACT):
1. PENTING: Gunakan Archetype / Sudut Pandang: ${angleType} (${angleDesc})${learnedInsights}.
2. Tulis murni seperti POV pengguna asli di media sosial yang bercerita dengan tenang, wajar, dan mengalir alami.
3. ATURAN KETAT PEMBUKA (HOOK):
   - JANGAN PERNAH memulai dengan kata lebay/klise: "Sumpah", "Sumpah ya", "Sumpah deh", "Jujurly", "Gila sih", "Gak habis pikir", "Guys mau spill", "Halo semua".
   - Awali dengan observasi nyata, situasi spesifik, atau langsung masuk ke inti cerita secara dewasa dan mengalir santai.
4. Jangan sampai terlihat jualan di postingan pertama. Dilarang hashtag berlebihan.${antiRepetitionRule}

Alur 2-Langkah Wajib:
- Post 1 (Main Post / Hook): Panjang TEKS MAKSIMAL 150 KARAKTER. Tembak langsung masalah + klaim mutlak atau pura-pura minta review (Curiosity Inverted). Curhat masalah harian secara relatable. Asumsikan akan ditempel Foto/Video. JANGAN taruh link di Post 1.
- Post 2 (First Reply / CTA): Tulis kalimat singkat natural memberikan Link Pembelian (CTA). Contoh: "Banyak yg nanya, aku spill tokonya di sini ya mumpung diskon 👇 [affiliateUrl]". Sebutkan harganya (${price}).

Konten Tambahan untuk Multi-Platform:
- X (Twitter): Teks yang sama dengan Threads (Post 1 dan Post 2).
- Facebook: Buat 1 postingan lengkap bergaya review personal mendalam. PENTING: JANGAN menyertakan link apapun di dalam teks utama Facebook! Cukup beri arahan halus di akhir kalimat.
- fbComment: Komentar pertama Facebook berisi link produk promo: misal 'Beli di sini ya kak: [affiliateUrl]'

Format output HANYA JSON object murni:
{
  "hook": "teks post 1 (maksimal 150 karakter, tanpa link)",
  "cta": "teks post 2 (reply pertama berisi link dan CTA)",
  "xContent": "Teks postingan untuk X (Twitter) + Link",
  "fbContent": "Teks ulasan lengkap untuk Facebook Page tanpa link (arahin ke komentar)",
  "fbComment": "Beli di sini ya kak: [affiliateUrl]"
}
`;
  const result = await callGemini(prompt);
  const clean = extractJson(result);
  const parsed = JSON.parse(clean);

  return {
    hook: parsed.hook || `Ada satu hal yang baru kusadari soal masalah ini...`,
            cta: parsed.cta || `Harganya cuma ${price}, cek di sini 👉 ${affiliateUrl}`,
    story: "",
    review: "",
    chain: [
      parsed.hook || `Satu hal yang bikin sadar...`,
      parsed.cta || `Cek promo di ${affiliateUrl}`,
    ],
    xContent: parsed.xContent || parsed.hook,
    fbContent: parsed.fbContent || `${parsed.hook}\n\n${parsed.story}\n\n${parsed.review}\n\n👉 Info pembelian & link tokonya sudah aku sematkan di komentar pertama ya 👇`,
    fbComment: parsed.fbComment || `Beli di sini ya kak: ${affiliateUrl}`
  };
}

/**
 * 2b. Thematic Content Generation (Niche / Non-Product Centric)
 * Menghasilkan konten bernilai tinggi berdasarkan Tema/Niche, lalu menyisipkan rekomendasi produk secara halus di akhir/komentar.
 */
export async function generateThematicContent(
  theme: string,
  productName: string,
  price: string,
  affiliateUrl: string
): Promise<ThreadPostDraft> {
  const prompt = `
Kamu adalah seorang content creator profesional, cerdas, dan disukai netizen di media sosial (Threads, X, dan Facebook).
Tugasmu adalah membuat konten organik yang membahas TEMA/TOPIK tertentu yang bernilai, edukatif, atau sangat menghibur/relatable bagi audiens.

TEMA KONTEN: "${theme}"
PRODUK REKOMENDASI (Disisipkan secara halus di akhir):
- Nama Produk: ${productName}
- Harga: ${price}
- Link: ${affiliateUrl}

Instruksi Kreatif:
1. Jangan membuat konten yang dari awal langsung review barang! Fokus 80% membicarakan masalah, tips, lifehack, atau opini menarik seputar TEMA di atas.
2. Gaya bahasa santai, berbobot, manusiawi, dan sama sekali tidak terdengar seperti bot/marketing kaku.
3. ATURAN KETAT PEMBUKA (HOOK):
   - JANGAN PERNAH memulai dengan kata lebay/klise: "Sumpah", "Sumpah ya", "Jujurly", "Gila sih", "Gak habis pikir".
   - Buka langsung dengan pernyataan fakta, tips solutif, atau observasi menarik yang tenang dan berwawasan.
4. Hanya di akhir cerita/tips, sebutkan bahwa produk rekomendasi (${productName}) adalah salah satu alat bantu yang mempermudah hal tersebut.

Alur 2-Langkah:
- Post 1 (Main Post / Hook): Opini atau fakta menarik / keresahan nyata seputar tema "${theme}". Padatkan tips/edukasi dalam postingan ini. Panjang maksimal 180 karakter. Jangan sertakan link.
- Post 2 (First Reply / CTA): Cerita singkat bagaimana produk ${productName} membantu, sebutkan harga ${price} dan link Shopee (${affiliateUrl}).

Konten Facebook Page:
- Satu tulisan panjang lengkap yang sangat bermanfaat untuk dibaca followers tentang "${theme}".
- PENTING: JANGAN menyertakan link apapun di teks postingan utama. Berikan penutup: "Kalau butuh rekomendasi ${productName}-nya, link belinya sudah aku cantumkan di komentar pertama ya 👇"

Format output HANYA JSON object murni:
{
  "hook": "teks post 1 (tips padat, maks 180 chars)",
  "cta": "teks post 2 (kaitan solusi dan link affiliate)",
  "xContent": "Teks untuk X (Twitter) + Link",
  "fbContent": "Teks ulasan/artikel Facebook tanpa link",
  "fbComment": "Beli ${productName} resmi di sini ya kak: ${affiliateUrl}"
}
`;

  const result = await callGemini(prompt);
  const clean = extractJson(result);
  const parsed = JSON.parse(clean);

  return {
    hook: parsed.hook || `Satu hal penting tentang ${theme} yang jarang dibahas orang:`,
            cta: parsed.cta || `Harganya cuma ${price}, cek promo di sini 👉 ${affiliateUrl}`,
    story: "",
    review: "",
    chain: [
      parsed.hook || `Tips tentang ${theme}:`,
      parsed.cta || `Cek promo di ${affiliateUrl}`,
    ],
    xContent: parsed.xContent || parsed.hook,
    fbContent: parsed.fbContent || `${parsed.hook}\n\n${parsed.story}\n\n${parsed.review}\n\n👉 Info dan link ${productName} sudah disematkan di komentar pertama ya 👇`,
    fbComment: parsed.fbComment || `Beli di sini ya kak: ${affiliateUrl}`
  };
}

/**
 * 3. Anti-Repetition Check (Similarity compare)
 * Menggunakan perbandingan kata/token instan (0ms) untuk mencegah timeout Vercel
 */
export async function checkAntiRepetition(newHook: string, previousHooks: string[]): Promise<ValidationResult> {
  if (previousHooks.length === 0) {
    return { pass: true, score: 0.0 };
  }

  // Tokenize & check Jaccard similarity across previous hooks
  const tokenize = (s: string) => new Set(s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3));
  const newTokens = tokenize(newHook);

  let maxSim = 0;
  for (const prev of previousHooks) {
    const prevTokens = tokenize(prev);
    const intersection = new Set([...newTokens].filter(x => prevTokens.has(x)));
    const union = new Set([...newTokens, ...prevTokens]);
    const sim = union.size === 0 ? 0 : intersection.size / union.size;
    if (sim > maxSim) maxSim = sim;
  }

  // Jika overlap kata lebih dari 65%, anggap terlalu mirip
  const isTooSimilar = maxSim > 0.65;
  return {
    pass: !isTooSimilar,
    score: parseFloat(maxSim.toFixed(2)),
    reason: isTooSimilar ? `Kemiripan kata terlalu tinggi (${(maxSim * 100).toFixed(0)}%) dengan hook sebelumnya.` : undefined
  };
}

/**
 * 4. Automated Quality Check
 * Validasi kepatuhan format & gaya bahasa secara instan (0ms)
 */
export async function qualityCheckContent(draft: ThreadPostDraft): Promise<ValidationResult> {
  // Cek apakah 4 bagian utama terisi
  if (!draft.hook || !draft.cta) {
    return { pass: false, score: 0.0, reason: "Bagian Hook atau CTA utas kosong." };
  }

  // Cek apakah ada link di CTA
  const hasLinkInCta = draft.cta.includes("http://") || draft.cta.includes("https://");
  if (!hasLinkInCta) {
    return { pass: false, score: 0.5, reason: "Link produk tidak ditemukan pada CTA (Balasan)." };
  }

  // Cek kata-kata terlarang / pembuka klise di Hook
  const forbiddenKeywords = ["sumpah", "jujurly", "gila sih", "gak habis pikir", "guys mau spill", "halo semua", "spill racun"];
  const lowerHook = draft.hook.toLowerCase();
  for (const word of forbiddenKeywords) {
    if (lowerHook.includes(word)) {
      return { pass: false, score: 0.4, reason: `Hook mengandung kata terlarang: "${word}".` };
    }
  }

  return {
    pass: true,
    score: 0.96,
  };
}
