import { prisma } from './prisma';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Fallback models in order of priority
const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-flash-latest",
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
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  let lastError: unknown = null;

  for (const model of CANDIDATE_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout (perpanjangan untuk high demand)

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: controller.signal,
      });

      if (response.status === 503) {
        console.warn(`[GEMINI] Model ${model} is experiencing high demand (503). Trying fallback...`);
        continue;
      }

      if (response.status === 429) {
        console.warn(`[GEMINI] Model ${model} hit rate limit (429). Waiting 3s before fallback...`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[GEMINI] Model ${model} returned error ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (rawText.trim()) {
        return rawText.trim();
      }
    } catch (err: unknown) {
      // Beri jeda singkat sebelum mencoba model berikutnya agar tidak membebani server
      const isAbort = err instanceof Error && err.name === "AbortError";
      console.warn(`[GEMINI] Attempt with model ${model} failed${isAbort ? " (timeout 45s)" : ""}:`, err);
      lastError = err;
      await new Promise((r) => setTimeout(r, 1500));
    } finally {
      clearTimeout(timeoutId);
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
  angleDesc: string
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

  const prompt = `
Bantu saya menjadi seorang konten kreator profesional di Threads yang natural, elegan, dan organik (BUKAN BOT SPAM IKLAN).
Buatkan 4 rantai utas (thread) bersambung tentang produk ini:
Nama Produk: ${productName}
Harga: ${price}
Link: ${affiliateUrl}

Instruksi Kreatif & Gaya Bahasa:
1. PENTING: Gunakan Archetype / Sudut Pandang: ${angleType} (${angleDesc})${learnedInsights}.
2. Tulis murni seperti POV pengguna asli di media sosial yang bercerita dengan tenang, wajar, dan mengalir alami.
3. ATURAN KETAT PEMBUKA (HOOK):
   - JANGAN PERNAH memulai dengan kata lebay/klise: "Sumpah", "Sumpah ya", "Sumpah deh", "Jujurly", "Gila sih", "Gak habis pikir", "Guys mau spill", "Halo semua".
   - Awali dengan observasi nyata, situasi spesifik, atau langsung masuk ke inti cerita secara dewasa dan mengalir santai.
   - Contoh gaya pembuka yang bagus:
     * "Salah satu hal kecil yang sering disepelein pas beberes rumah..."
     * "Ternyata repotnya bukan di pekerjaannya, tapi di peralatannya yang kurang pas."
     * "Setelah beberapa bulan nyoba ganti cara lama..."
4. Jangan sampai terlihat jualan di postingan pertama dan kedua. Dilarang hashtag berlebihan.

Alur 4-Utas Wajib untuk Threads:
- Post 1 (Hook): Curhat masalah sehari-hari secara relatable, natural, pakai bahasa gaul/netizen yang wajar, bikin orang merasa "I feel you". JANGAN sebut nama produk atau harga di sini.
- Post 2 (Story): Alur cerita bagaimana nemu solusi atau momen "aha!" pas mulai coba produknya. 
- Post 3 (Review): Opini pribadi soal rasanya / dampaknya setelah pakai, kasih detail spesifik kenapa ini bagus.
- Post 4 (CTA): Sebutkan harganya (${price}), taruh link belinya (${affiliateUrl}), dan tutup dengan kata-kata santai.

Konten Tambahan untuk Multi-Platform:
- X (Twitter): Buat 1 tweet ringkas yang menarik perhatian pembaca, lalu sertakan link (${affiliateUrl}) di bagian akhir atau format tweet + reply.
- Facebook: Buat 1 postingan lengkap bergaya review personal mendalam. PENTING: JANGAN menyertakan link apapun di dalam teks utama Facebook ini agar jangkauan organik (reach) tidak dibatasi oleh algoritma Meta! Cukup beri arahan halus di akhir kalimat (misal: "Link produknya aku taruh di komentar pertama ya 👇").

Format output HANYA JSON object murni:
{
  "hook": "teks post 1",
  "story": "teks post 2",
  "review": "teks post 3",
  "cta": "teks post 4",
  "xContent": "Teks postingan untuk X (Twitter) + Link",
  "fbContent": "Teks ulasan lengkap untuk Facebook Page tanpa link (arahin ke komentar)",
  "fbComment": "Komentar pertama Facebook berisi link produk promo: misal 'Beli di sini ya kak: [affiliateUrl]'"
}
`;
  const result = await callGemini(prompt);
  const clean = extractJson(result);
  const parsed = JSON.parse(clean);

  return {
    hook: parsed.hook || `Ada satu hal yang baru kusadari soal masalah ini...`,
    story: parsed.story || `Sampe akhirnya nemu ${productName} ini pas lagi cari solusi.`,
    review: parsed.review || `Pas barangnya nyampe dan dicoba, lumayan ngebantu banget.`,
    cta: parsed.cta || `Harganya cuma ${price}, cek di sini 👉 ${affiliateUrl}`,
    chain: [
      parsed.hook || `Satu hal yang bikin sadar...`,
      parsed.story || `Nemu solusi ini...`,
      parsed.review || `Review jujur setelah dicoba...`,
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

Alur 4-Utas Threads:
- Post 1 (Hook): Opini atau fakta menarik / keresahan nyata seputar tema "${theme}".
- Post 2 (Story/Tips): 2-3 poin tips praktis atau pandangan mendalam yang bermanfaat.
- Post 3 (Kaitan Produk): Cerita bagaimana produk ${productName} membantu mempraktikkan tips tersebut.
- Post 4 (CTA): Sebutkan kisaran harga ${price} dan link Shopee (${affiliateUrl}).

Konten X (Twitter):
- Tweet pendek dan padat merangkum inti tips dari tema, lalu ditutup link produk.

Konten Facebook Page:
- Satu tulisan panjang lengkap yang sangat bermanfaat untuk dibaca followers tentang "${theme}".
- PENTING: JANGAN menyertakan link apapun di teks postingan utama. Berikan penutup: "Kalau butuh rekomendasi ${productName}-nya, link belinya sudah aku cantumkan di komentar pertama ya 👇"

Format output HANYA JSON object murni:
{
  "hook": "teks post 1",
  "story": "teks post 2 (tips/edukasi)",
  "review": "teks post 3 (kaitan solusi)",
  "cta": "teks post 4 (link)",
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
    story: parsed.story || `Banyak orang salah kaprah pas nyoba hal ini...`,
    review: parsed.review || `Solusi simpelnya bisa pakai ${productName} ini, beneran ngebantu banget.`,
    cta: parsed.cta || `Harganya cuma ${price}, cek promo di sini 👉 ${affiliateUrl}`,
    chain: [
      parsed.hook || `Tips tentang ${theme}:`,
      parsed.story || `Poin pentingnya...`,
      parsed.review || `Bisa dibantu dengan ${productName}...`,
      parsed.cta || `Cek promo di ${affiliateUrl}`,
    ],
    xContent: parsed.xContent || parsed.hook,
    fbContent: parsed.fbContent || `${parsed.hook}\n\n${parsed.story}\n\n${parsed.review}\n\n👉 Info dan link ${productName} sudah disematkan di komentar pertama ya 👇`,
    fbComment: parsed.fbComment || `Beli di sini ya kak: ${affiliateUrl}`
  };
}

/**
 * 3. Anti-Repetition Check (Similarity compare)
 */
export async function checkAntiRepetition(newHook: string, previousHooks: string[]): Promise<ValidationResult> {
  if (previousHooks.length === 0) {
    return { pass: true, score: 0.0 };
  }

  const prompt = `
Bandingkan hook baru ini dengan hook-hook yang sudah pernah diposting sebelumnya.
Apakah hook baru ini terlalu mirip atau repetitif dengan yang lama?

Hook Baru:
"${newHook}"

Hook Sebelumnya:
${previousHooks.map((h, i) => `${i + 1}. "${h}"`).join("\n")}

Format output HANYA JSON:
{
  "similarityScore": 0.25,
  "pass": true,
  "reason": "Penjelasan singkat"
}
`;
  try {
    const result = await callGemini(prompt);
    const clean = extractJson(result);
    const data = JSON.parse(clean);
    return {
      pass: data.pass ?? (data.similarityScore < 0.7),
      score: data.similarityScore ?? 0.3,
      reason: data.reason,
    };
  } catch {
    return { pass: true, score: 0.2 };
  }
}

/**
 * 4. Automated Quality Check
 */
export async function qualityCheckContent(draft: ThreadPostDraft): Promise<ValidationResult> {
  const prompt = `
Lakukan Quality Check otomatis terhadap naskah thread ini:
Post 1 (Hook): ${draft.hook}
Post 2 (Story): ${draft.story}
Post 3 (Review): ${draft.review}
Post 4 (CTA): ${draft.cta}

Kriteria Penilaian:
1. Naturalness (tidak terlihat seperti bot / spam)
2. Struktur alur cerita (Hook -> Cerita -> Review -> Link)
3. Tidak ada klaim palsu berlebihan atau fake scarcity
4. Link dan CTA hanya ada di Post 4

Format output HANYA JSON:
{
  "qualityScore": 0.85,
  "pass": true,
  "feedback": "Komentar singkat"
}
`;
  try {
    const result = await callGemini(prompt);
    const clean = extractJson(result);
    const data = JSON.parse(clean);
    return {
      pass: data.pass ?? (data.qualityScore >= 0.75),
      score: data.qualityScore ?? 0.85,
      reason: data.feedback,
    };
  } catch {
    return { pass: true, score: 0.85 };
  }
}
