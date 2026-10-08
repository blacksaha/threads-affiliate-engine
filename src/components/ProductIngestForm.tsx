"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useUI } from "@/components/ui/ModalProvider";

export default function ProductIngestForm() {
  const router = useRouter();
  const { toast } = useUI();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleScrape = async () => {
    const urlMatch = url.match(/https?:\/\/[^\s]+/i);
    const extractedUrl = urlMatch ? urlMatch[0] : url.trim();

    if (!extractedUrl.includes("shopee.co.id") && !extractedUrl.includes("shp.ee") && !extractedUrl.includes("tiktok.com") && !extractedUrl.includes("tokopedia.com")) {
      toast.error("Masukkan link marketplace yang valid (Shopee / TikTok Shop / Tokopedia)!", "Link Tidak Dikenal");
      return;
    }
    
    // Auto-extract price if user pasted full share text
    const priceMatch = url.match(/rp\s*([\d.,]+)/i) || url.match(/seharga\s*rp?\s*([\d.,]+)/i);
    let extractedPrice = price;
    if (priceMatch && !price) {
      extractedPrice = priceMatch[1].replace(/[.,]/g, "");
      setPrice(extractedPrice);
    }
    
    setUrl(extractedUrl);
    setLoading(true);
    try {
      const res = await fetch("/api/products/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: extractedUrl })
      });
      const json = await res.json();
      if (json.success) {
        setName(json.data.name || "");
        if (!extractedPrice || extractedPrice === "Cek Promo") setPrice(json.data.price || "Cek Promo");
        setImageUrl(json.data.imageUrl || "");
        toast.success("Informasi produk berhasil ditarik!", "Scrape Berhasil");
      } else {
        toast.error(json.error || "Gagal menarik metadata produk", "Gagal Scrape");
      }
    } catch (e: any) {
      toast.error(e.message || String(e), "Koneksi Error");
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          name,
          price,
          affiliateUrl: url,
          imageUrl,
          theme,
        })
      });
      if (res.ok) {
        // Reset form
        setUrl("");
        setName("");
        setPrice("");
        setImageUrl("");
        toast.success("Produk berhasil dimasukkan ke Pipeline Engine!", "Pipeline Aktif");
        router.refresh();
      } else {
        toast.error("Gagal menyimpan produk ke database.", "Gagal Simpan");
      }
    } catch (error: any) {
      toast.error("Gagal menyimpan: " + (error.message || String(error)), "Error");
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Smart Scraper Field */}
      <div className="cartoon-card bg-amber-100 p-3 space-y-2">
        <label className="block text-xs font-black text-black">⚡ AUTO-SCRAPER SHOPEE</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste link Shopee di sini..."
            className="cartoon-input flex-1 bg-white px-3 py-2 text-xs font-bold text-black placeholder-gray-400"
            required
          />
          <button
            type="button"
            onClick={handleScrape}
            disabled={loading || !url}
            className="cartoon-btn px-4 py-2 bg-main text-black text-xs font-black flex items-center gap-1 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Tarik Data"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-black text-black mb-1">NAMA PRODUK</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Contoh: Meja Lipat Portable"
            className="cartoon-input w-full bg-white px-3 py-2 text-xs font-bold text-black"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black text-black mb-1">HARGA</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              placeholder="Contoh: 150.000"
              className="cartoon-input w-full bg-white px-3 py-2 text-xs font-bold text-black"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-black mb-1">GAMBAR URL</label>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="cartoon-input w-full bg-white px-3 py-2 text-xs font-bold text-black"
            />
          </div>
        </div>

        <div className="cartoon-card bg-blue-50 p-3 space-y-1">
          <label className="block text-xs font-black text-blue-900">🎯 THEMATIC MODE (SOFT-SELLING)</label>
          <p className="text-[10px] font-bold text-gray-600">
            Jika diisi, AI akan bikin konten edukasi seputar tema ini lalu menyelipkan link produk di akhir.
          </p>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Contoh: Tips Dekorasi Kamar Kost Estetik"
            className="cartoon-input w-full bg-white px-3 py-2 text-xs font-bold text-black"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full cartoon-btn py-3 bg-[#111111] hover:bg-black text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin text-white" />
        ) : (
          <>
            JALANKAN AUTO-PIPELINE
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </>
        )}
      </button>
    </form>
  );
}
