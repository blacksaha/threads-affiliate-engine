require('dotenv').config();

const EXTRACTOR_PROMPT = `Anda adalah AI asisten bot yang cerdas dalam mengekstrak data produk Shopee dari pesan pengguna.
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

const CANDIDATE_MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b"
];

async function callGemini(prompt) {
  for (const model of CANDIDATE_MODELS) {
    try {
      console.log("Trying model:", model);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
        })
      });
      const data = await response.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      } else {
        console.log("Error from API:", JSON.stringify(data));
      }
    } catch(e) {
      console.error(e);
    }
  }
  throw new Error("All models failed");
}

async function run() {
  const userMsg = "Cek BUBUK MINUMAN TEA 1 SASET 15 GRAM dengan harga Rp1.307. Dapatkan di Shopee sekarang! https://s.shopee.co.id/8AWNwFmYeF?share_channel_code=2";
  const p = EXTRACTOR_PROMPT.replace("{MESSAGE}", userMsg);
  const res = await callGemini(p);
  console.log("Raw:", res);
  console.log("Parsed:", JSON.parse(extractJson(res)));
}
run();
