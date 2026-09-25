import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url || !url.includes('shopee.co.id')) {
      return NextResponse.json({ success: false, error: 'URL Shopee tidak valid.' }, { status: 400 });
    }

    // 1. Fetch OpenGraph data by pretending to be Telegram Bot (bypasses Anti-Bot)
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'TelegramBot (like TwitterBot)',
        'Accept': 'text/html',
      }
    });

    const html = await res.text();
    
    // 2. Extract OpenGraph tags manually
    const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)">/i);
    const ogDescMatch = html.match(/<meta property="og:description" content="([^"]+)">/i);
    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)">/i);

    let title = ogTitleMatch ? ogTitleMatch[1] : '';
    let description = ogDescMatch ? ogDescMatch[1] : '';
    const imageUrl = ogImageMatch ? ogImageMatch[1] : '';

    if (!title && !description) {
      return NextResponse.json({ success: false, error: 'Gagal menembus proteksi Shopee. Silakan input manual.' }, { status: 400 });
    }

    // 3. Clean up the data using Gemini AI
    const prompt = `
Ekstrak dan bersihkan informasi produk Shopee dari teks OpenGraph berikut.
Fokus ambil nama produk yang bersih, hapus kata-kata spam promosi (seperti "Beli", "Harga Murah", "Gratis Ongkir", "COD", dll).
Tebak harga produk berdasarkan deskripsi jika ada, jika tidak ada tulis "Cek Link".

Title Asli: ${title}
Description Asli: ${description}

Output HANYA JSON murni:
{
  "name": "Nama produk bersih tanpa spam",
  "price": "100.000 atau Cek Promo"
}
`;

    let cleanName = title.replace(/^Jual\s+/i, '');
    let cleanPrice = 'Cek Promo';

    try {
      const geminiRes = await callGemini(prompt);
      let cleaned = geminiRes.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.name) cleanName = parsed.name;
      if (parsed.price) cleanPrice = parsed.price;
    } catch (e) {
      console.warn("Gemini parsing failed, using raw OpenGraph fallback:", e);
    }

    return NextResponse.json({
      success: true,
      data: {
        name: cleanName,
        price: cleanPrice,
        imageUrl: imageUrl
      }
    });

  } catch (error: any) {
    console.error('[SCRAPE API ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
