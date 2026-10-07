"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";

export default function ProductIngestForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleScrape = async () => {
    if (!url.includes("shopee.co.id") && !url.includes("shp.ee")) {
      alert("Masukkan link Shopee yang valid!");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/products/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const json = await res.json();
      if (json.success) {
        setName(json.data.name || "");
        setPrice(json.data.price || "");
        setImageUrl(json.data.imageUrl || "");
      } else {
        alert(json.error || "Gagal scrape produk");
      }
    } catch (e) {
      alert("Error: " + String(e));
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
        alert("✅ Produk berhasil dimasukkan ke Pipeline Engine!");
        router.refresh();
      } else {
        alert("❌ Gagal menyimpan produk.");
      }
    } catch (error) {
      alert("Error submit: " + String(error));
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
