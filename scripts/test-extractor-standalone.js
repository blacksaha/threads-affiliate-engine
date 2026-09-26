require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const EXTRACTOR_PROMPT = `Anda adalah AI asisten bot yang cerdas dalam mengekstrak data produk Shopee dari pesan pengguna.
PESAN BISA BERISI:
1. HANYA LINK (contoh: https://s.shopee.co.id/xxx)
2. TEKS LENGKAP DARI SHOPEE SHARE MESSAGE (judul produk, harga, dll + link)

TUGAS ANDA:
1. Cari SEMUA URL yang mengandung "shopee.co.id" atau "shp.ee" di pesan.
2. Jika ada teks lain di sekitar link, CARIKAN JUDUL PRODUK & HARGA dari teks tersebut.
3. Output HANYA dalam format JSON murni.

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

async function testExtract() {
  const userMsg = "Cek BUBUK MINUMAN TEA 1 SASET 15 GRAM dengan harga Rp1.307. Dapatkan di Shopee sekarang! https://s.shopee.co.id/8AWNwFmYeF?share_channel_code=2";
  const prompt = EXTRACTOR_PROMPT.replace("{MESSAGE}", userMsg);
  
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  console.log("Raw Result:\n", result.response.text());
}

testExtract();
