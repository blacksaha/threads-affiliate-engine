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

// Fallback models in order of priority.
// NOTE: keep this list in sync with README/docs. `gemini-flash-latest` is the
// alias Google keeps pointed at a healthy flash model, so it must stay here as
// the last-resort entry: when every pinned version is saturated it is usually
// the only one still serving.
const CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
];

// How many full passes over CANDIDATE_MODELS we make before giving up. A single
// pass is not enough: 503 means "high demand, try again shortly" and the whole
// key pool shares the same model capacity, so a burst of Shopee links would
// otherwise burn every model once and fail instantly.
const MAX_ROUNDS = 3;

// Backoff between rounds, in ms. Index = round number.
const ROUND_BACKOFF_MS = [1500, 4000, 8000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface CallGeminiOptions {
  /** Overrides the default 40s per-request timeout (ms). */
  timeoutMs?: number;
  /**
   * Total wall-clock budget for the whole call (ms). Defaults to 45s so the
   * request still fits inside the 60s serverless maxDuration: without a ceiling
   * the round x model x key loops could run for many minutes and Vercel would
   * kill the function, losing the request entirely.
   */
  deadlineMs?: number;
  provider?: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  deepseekApiKey?: string | null;
  deepseekBaseUrl?: string | null;
}

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

async function executeDeepSeek(prompt: string, apiKey: string, baseUrl?: string | null, timeoutMs = 40000): Promise<string> {
  let base = (baseUrl || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim().replace(/\/+$/, "");
  const endpoint = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a professional Indonesian content creator and copywriter." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`DeepSeek Error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    if (content.trim()) return content.trim();
    throw new Error("Empty response from DeepSeek API");
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw new Error(`DeepSeek API failed: ${err.message}`);
  }
}

export async function callGemini(prompt: string, opts: CallGeminiOptions = {}): Promise<string> {
  const isDeepSeek = opts.provider === "DEEPSEEK";
  const dsKey = opts.deepseekApiKey || (isDeepSeek ? opts.apiKey : null) || process.env.DEEPSEEK_API_KEY;

  if (isDeepSeek) {
    if (!dsKey) throw new Error("DeepSeek API Key is not configured.");
    return executeDeepSeek(prompt, dsKey, opts.baseUrl || opts.deepseekBaseUrl, opts.timeoutMs);
  }

  // If user provided custom Google Gemini API Key
  const customKey = opts.apiKey;
  const activeKeys = customKey ? [customKey] : GEMINI_API_KEYS;

  if (activeKeys.length === 0) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const timeoutMs = opts.timeoutMs ?? 40000;
  const deadlineMs = opts.deadlineMs ?? 45000;
  const startedAt = Date.now();
  let lastError: unknown = null;

  // Outer loop = rounds. Inner loops = every model x every key
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (Date.now() - startedAt >= deadlineMs) {
      console.warn(`[GEMINI] Deadline of ${deadlineMs}ms reached before round ${round + 1}.`);
      break;
    }

    if (round > 0) {
      const wait = ROUND_BACKOFF_MS[Math.min(round - 1, ROUND_BACKOFF_MS.length - 1)];
      if (Date.now() - startedAt + wait >= deadlineMs) break;
      console.warn(`[GEMINI] Round ${round + 1}/${MAX_ROUNDS} after ${wait}ms backoff. Last error: ${String(lastError)}`);
      await sleep(wait);
    }

    for (const model of CANDIDATE_MODELS) {
      for (let keyAttempt = 0; keyAttempt < activeKeys.length; keyAttempt++) {
        if (Date.now() - startedAt >= deadlineMs) break;

        const apiKey = customKey || getNextApiKey();
        const controller = new AbortController();
        const remaining = deadlineMs - (Date.now() - startedAt);
        const timeoutId = setTimeout(() => controller.abort(), Math.max(1000, Math.min(timeoutMs, remaining)));

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
            console.warn(`[GEMINI] Model ${model} overloaded (503). Rotating key...`);
            lastError = "Server overloaded (503)";
            continue;
          }

          if (response.status === 429 || response.status === 403 || response.status === 400) {
            console.warn(`[GEMINI] Model ${model} returned ${response.status} on key. Rotating to next API Key...`);
            lastError = `Status ${response.status} on key - Switching Key`;
            continue;
          }

          if (!response.ok) {
            const errorText = await response.text();
            console.warn(`[GEMINI] Model ${model} returned error ${response.status}: ${errorText}`);
            lastError = `HTTP ${response.status} - ${errorText.substring(0, 100)}`;
            continue;
          }

          const data = await response.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (rawText.trim()) {
            clearTimeout(timeoutId);
            return rawText.trim();
          }

          // 200 with no usable text (safety block / empty candidate): treat as a
          // failed attempt for this key rather than silently returning "".
          lastError = "Empty response from model";
        } catch (err: unknown) {
          const isAbort = err instanceof Error && err.name === "AbortError";
          console.warn(`[GEMINI] Attempt with model ${model} failed${isAbort ? " (timeout)" : ""}:`, err);
          lastError = err;
          // Short pause so a flaky network call does not hammer the endpoint.
          await sleep(500);
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }
  }

  // AUTO-FAILOVER KE DEEPSEEK JIKA GEMINI KENA 429/LIMIT/OVERLOAD
  if (dsKey) {
    console.warn(`[FAILOVER] Gemini rate-limited or unavailable. Auto-switching to DeepSeek fallback...`);
    try {
      const fallbackResult = await executeDeepSeek(prompt, dsKey, opts.deepseekBaseUrl || opts.baseUrl, opts.timeoutMs);
      if (fallbackResult) {
        console.log(`[FAILOVER SUCCESS] Content generated successfully using DeepSeek!`);
        return fallbackResult;
      }
    } catch (dsErr: any) {
      console.error(`[FAILOVER ERROR] DeepSeek fallback also failed: ${dsErr.message}`);
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${String(lastError)}`);
}

/**
 * 1. Product Analysis & Content Angles
 */
export async function generateProductAngles(productName: string, price: string, description?: string, aiConfig?: CallGeminiOptions) {
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
    const result = await callGemini(prompt, aiConfig);
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
  previousHooks: string[] = [],
  aiConfig?: CallGeminiOptions
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

Alur 3-Langkah Wajib (PENTING! Pastikan persis 3 post terpisah):
- Post 1 (Main Post / Hook): Panjang TEKS MAKSIMAL 150 KARAKTER. Tembak langsung masalah + klaim mutlak atau pura-pura minta review (Curiosity Inverted). Curhat masalah harian secara relatable. Asumsikan akan ditempel Foto Produk. JANGAN taruh link di Post 1.
- Post 2 (First Reply / Story & Review): Berikan konteks lanjutan, cerita pengalaman nyata, atau tips singkat mengapa produk ini sangat membantu. Fokus pada *value* atau manfaatnya. Maksimal 200 karakter. JANGAN taruh link di Post 2.
- Post 3 (Second Reply / CTA): Tulis kalimat santai natural memberikan Link Pembelian (CTA) di utas penutup. Contoh: "Banyak yg nanya, aku spill belinya di sini ya mumpung diskon 👇 [affiliateUrl]". Sebutkan harganya (${price}).

Konten Tambahan untuk Multi-Platform:
- X (Twitter): Teks yang sama dengan Threads (Post 1, Post 2, Post 3).
- Facebook: Buat 1 postingan lengkap bergaya review personal mendalam. PENTING: JANGAN menyertakan link apapun di dalam teks utama Facebook! Cukup beri arahan halus di akhir kalimat.
- fbComment: Komentar pertama Facebook berisi link produk promo: misal 'Beli di sini ya kak: [affiliateUrl]'

Format output HANYA JSON object murni:
{
  "hook": "teks post 1 (maksimal 150 karakter, tanpa link)",
  "review": "teks post 2 (cerita/review singkat, tanpa link)",
  "cta": "teks post 3 (reply penutup berisi link dan CTA)",
  "xContent": "Teks postingan untuk X (Twitter) + Link",
  "fbContent": "Teks ulasan lengkap untuk Facebook Page tanpa link (arahin ke komentar)",
  "fbComment": "Beli di sini ya kak: [affiliateUrl]"
}
`;
  const result = await callGemini(prompt, aiConfig);
  const clean = extractJson(result);
  const parsed = JSON.parse(clean);

  return {
    hook: parsed.hook || `Ada yang pernah ngalamin masalah ini juga?`,
    review: parsed.review || `Barang ini ngebantu banget buat aku sih.`,
    cta: parsed.cta || `Kebetulan lagi ada promo harganya ${price}, cek aja di sini 👉 ${affiliateUrl}`,
    story: "",
    chain: [
      parsed.hook || `Ada masalah ini?`,
      parsed.review || `Ini solusinya.`,
      parsed.cta || `Link: ${affiliateUrl}`,
    ],
    xContent: parsed.xContent || `${parsed.hook}\n\n${parsed.review}\n\n👉 Cek promo: ${affiliateUrl}`,
    fbContent: parsed.fbContent || `${parsed.hook}\n\n${parsed.review}\n\n👉 Info dan link produk sudah disematkan di komentar pertama ya 👇`,
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
  affiliateUrl: string,
  aiConfig?: CallGeminiOptions
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

Alur 3-Langkah Wajib (Pastikan persis 3 post terpisah):
- Post 1 (Main Post / Hook): Opini atau fakta menarik / keresahan nyata seputar tema "${theme}". Padatkan tips/edukasi dalam postingan ini. Panjang maksimal 180 karakter. Jangan sertakan link. Asumsikan ada Foto Produk.
- Post 2 (First Reply / Insight & Tips): Penjelasan lanjutan yang solutif dan bernilai tambah. Maksimal 200 karakter. Jangan sertakan link.
- Post 3 (Second Reply / CTA): Cerita singkat bagaimana produk ${productName} membantu, sebutkan harga ${price} dan link Shopee (${affiliateUrl}).

Konten Facebook Page:
- Satu tulisan panjang lengkap yang sangat bermanfaat untuk dibaca followers tentang "${theme}".
- PENTING: JANGAN menyertakan link apapun di teks postingan utama. Berikan penutup: "Kalau butuh rekomendasi ${productName}-nya, link belinya sudah aku cantumkan di komentar pertama ya 👇"

Format output HANYA JSON object murni:
{
  "hook": "teks post 1 (tips padat, maks 180 chars)",
  "review": "teks post 2 (insight lanjutan)",
  "cta": "teks post 3 (kaitan solusi dan link affiliate)",
  "xContent": "Teks untuk X (Twitter) + Link",
  "fbContent": "Teks ulasan/artikel Facebook tanpa link",
  "fbComment": "Beli ${productName} resmi di sini ya kak: ${affiliateUrl}"
}
`;

  const result = await callGemini(prompt, aiConfig);
  const clean = extractJson(result);
  const parsed = JSON.parse(clean);

  return {
    hook: parsed.hook || `Satu hal penting tentang ${theme} yang jarang dibahas orang:`,
    review: parsed.review || `Intinya ada kebiasaan kecil yang sering kita abaikan.`,
    cta: parsed.cta || `Harganya cuma ${price}, cek promo di sini 👉 ${affiliateUrl}`,
    story: "",
    chain: [
      parsed.hook || `Tips tentang ${theme}:`,
      parsed.review || `Penjelasan lanjutan.`,
      parsed.cta || `Cek promo di ${affiliateUrl}`,
    ],
    xContent: parsed.xContent || `${parsed.hook}\n\n${parsed.review}\n\n👉 Cek info: ${affiliateUrl}`,
    fbContent: parsed.fbContent || `${parsed.hook}\n\n${parsed.review}\n\n👉 Info dan link ${productName} sudah disematkan di komentar pertama ya 👇`,
    fbComment: parsed.fbComment || `Beli di sini ya kak: ${affiliateUrl}`
  };
}

/**
 * 3. Anti-Repetition Check (Similarity compare)
 * Menggunakan perbandingan kata/token instan (0ms) untuk mencegah timeout Vercel
 *
 * `threshold` comes from AutomationSettings.similarityThreshold (0.7 by default).
 * It used to be hardcoded at 0.65, which made the setting in the UI a no-op and
 * rejected hooks the user had explicitly configured as acceptable.
 */
export async function checkAntiRepetition(
  newHook: string,
  previousHooks: string[],
  threshold = 0.65
): Promise<ValidationResult> {
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

  const isTooSimilar = maxSim > threshold;
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
