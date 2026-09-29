import re

with open('D:/BELAJAR/threads-affiliate-engine/src/lib/gemini.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace generateThreadContent
func1_start = text.find('export async function generateThreadContent')
func1_end = text.find('export async function generateThematicContent')
# Wait, let's use simple string replacements for the specific prompt sections.

text = text.replace(
'''Buatkan 4 rantai utas (thread) bersambung tentang produk ini:''',
'''Tugasmu adalah membuat draft postingan bersambung tentang produk affiliate:'''
)

text = text.replace(
'''Instruksi Kreatif & Gaya Bahasa:''',
'''Instruksi Kreatif & Gaya Bahasa (ARSITEKTUR 2-STEP COMPACT):'''
)

text = text.replace(
'''4. Jangan sampai terlihat jualan di postingan pertama dan kedua. Dilarang hashtag berlebihan.${antiRepetitionRule}

Alur 4-Utas Wajib untuk Threads:
- Post 1 (Hook): Curhat masalah sehari-hari secara relatable, natural, pakai bahasa gaul/netizen yang wajar, bikin orang merasa "I feel you". JANGAN sebut nama produk atau harga di sini.
- Post 2 (Story): Alur cerita bagaimana nemu solusi atau momen "aha!" pas mulai coba produknya. 
- Post 3 (Review): Opini pribadi soal rasanya / dampaknya setelah pakai, kasih detail spesifik kenapa ini bagus.
- Post 4 (CTA): Sebutkan harganya (${price}), taruh link belinya (${affiliateUrl}), dan tutup dengan kata-kata santai.

Konten Tambahan untuk Multi-Platform:
- X (Twitter): Buat 1 tweet ringkas yang menarik perhatian pembaca, lalu sertakan link (${affiliateUrl}) di bagian akhir atau format tweet + reply.
- Facebook: Buat 1 postingan lengkap bergaya review personal mendalam. PENTING: JANGAN menyertakan link apapun di dalam teks utama Facebook ini agar jangkauan organik (reach) tidak dibatasi oleh algoritma Meta! Cukup beri arahan halus di akhir kalimat (misal: "Link produknya aku taruh di komentar pertama ya 👇").''',
'''4. Jangan sampai terlihat jualan di postingan pertama. Dilarang hashtag berlebihan.${antiRepetitionRule}

Alur 2-Langkah Wajib:
- Post 1 (Main Post / Hook): Panjang TEKS MAKSIMAL 150 KARAKTER. Tembak langsung masalah + klaim mutlak atau pura-pura minta review (Curiosity Inverted). Curhat masalah harian secara relatable. Asumsikan akan ditempel Foto/Video. JANGAN taruh link di Post 1.
- Post 2 (First Reply / CTA): Tulis kalimat singkat natural memberikan Link Pembelian (CTA). Contoh: "Banyak yg nanya, aku spill tokonya di sini ya mumpung diskon 👇 [affiliateUrl]". Sebutkan harganya (${price}).

Konten Tambahan untuk Multi-Platform:
- X (Twitter): Teks yang sama dengan Threads (Post 1 dan Post 2).
- Facebook: Buat 1 postingan lengkap bergaya review personal mendalam. PENTING: JANGAN menyertakan link apapun di dalam teks utama Facebook! Cukup beri arahan halus di akhir kalimat.'''
)

text = text.replace(
'''{
  "hook": "teks post 1",
  "story": "teks post 2",
  "review": "teks post 3",
  "cta": "teks post 4",
  "xContent": "Teks postingan untuk X (Twitter) + Link",
  "fbContent": "Teks ulasan lengkap untuk Facebook Page tanpa link (arahin ke komentar)",
  "fbComment": "Beli di sini ya kak: [affiliateUrl]"
}''',
'''{
  "hook": "teks post 1 (maksimal 150 karakter, tanpa link)",
  "cta": "teks post 2 (reply pertama berisi link dan CTA)",
  "xContent": "Teks postingan untuk X (Twitter) + Link",
  "fbContent": "Teks ulasan lengkap untuk Facebook Page tanpa link (arahin ke komentar)",
  "fbComment": "Beli di sini ya kak: [affiliateUrl]"
}'''
)

text = text.replace(
'''    chain: [
      parsed.hook || `Satu hal yang bikin sadar...`,
      parsed.story || `Nemu solusi ini...`,
      parsed.review || `Review jujur setelah dicoba...`,
      parsed.cta || `Cek promo di ${affiliateUrl}`,
    ],''',
'''    story: "",
    review: "",
    chain: [
      parsed.hook || `Satu hal yang bikin sadar...`,
      parsed.cta || `Cek promo di ${affiliateUrl}`,
    ],'''
)

text = text.replace(
'''    fbContent: parsed.fbContent || `${parsed.hook}\n\n${parsed.story}\n\n${parsed.review}\n\n👉 Info pembelian & link tokonya sudah aku sematkan di komentar pertama ya 👇`,''',
'''    fbContent: parsed.fbContent || `${parsed.hook}\n\n👉 Info pembelian & link tokonya sudah aku sematkan di komentar pertama ya 👇`,'''
)

# For thematic
text = text.replace(
'''Alur 4-Utas Threads:
- Post 1 (Hook): Opini atau fakta menarik / keresahan nyata seputar tema "${theme}".
- Post 2 (Story/Tips): 2-3 poin tips praktis atau pandangan mendalam yang bermanfaat.
- Post 3 (Kaitan Produk): Cerita bagaimana produk ${productName} membantu mempraktikkan tips tersebut.
- Post 4 (CTA): Sebutkan kisaran harga ${price} dan link Shopee (${affiliateUrl}).

Konten X (Twitter):
- Tweet pendek dan padat merangkum inti tips dari tema, lalu ditutup link produk.''',
'''Alur 2-Langkah:
- Post 1 (Main Post / Hook): Opini atau fakta menarik / keresahan nyata seputar tema "${theme}". Padatkan tips/edukasi dalam postingan ini. Panjang maksimal 180 karakter. Jangan sertakan link.
- Post 2 (First Reply / CTA): Cerita singkat bagaimana produk ${productName} membantu, sebutkan harga ${price} dan link Shopee (${affiliateUrl}).'''
)

text = text.replace(
'''{
  "hook": "teks post 1",
  "story": "teks post 2 (tips/edukasi)",
  "review": "teks post 3 (kaitan solusi)",
  "cta": "teks post 4 (link)",''',
'''{
  "hook": "teks post 1 (tips padat, maks 180 chars)",
  "cta": "teks post 2 (kaitan solusi dan link affiliate)",'''
)

text = text.replace(
'''    chain: [
      parsed.hook || `Tips tentang ${theme}:`,
      parsed.story || `Poin pentingnya...`,
      parsed.review || `Bisa dibantu dengan ${productName}...`,
      parsed.cta || `Cek promo di ${affiliateUrl}`,
    ],''',
'''    story: "",
    review: "",
    chain: [
      parsed.hook || `Tips tentang ${theme}:`,
      parsed.cta || `Cek promo di ${affiliateUrl}`,
    ],'''
)

text = text.replace(
'''    fbContent: parsed.fbContent || `${parsed.hook}\n\n${parsed.story}\n\n${parsed.review}\n\n👉 Info dan link ${productName} sudah disematkan di komentar pertama ya 👇`,''',
'''    fbContent: parsed.fbContent || `${parsed.hook}\n\n👉 Info dan link ${productName} sudah disematkan di komentar pertama ya 👇`,'''
)

# quality check
text = text.replace(
'''if (!draft.hook || !draft.story || !draft.review || !draft.cta) {
    return { pass: false, score: 0.0, reason: "Salah satu bagian rantai utas kosong." };
  }''',
'''if (!draft.hook || !draft.cta) {
    return { pass: false, score: 0.0, reason: "Bagian Hook atau CTA utas kosong." };
  }'''
)

text = text.replace(
'''return { pass: false, score: 0.5, reason: "Link produk tidak ditemukan pada Post 4 (CTA)." };''',
'''return { pass: false, score: 0.5, reason: "Link produk tidak ditemukan pada CTA (Balasan)." };'''
)

with open('D:/BELAJAR/threads-affiliate-engine/src/lib/gemini.ts', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated successfully.')
