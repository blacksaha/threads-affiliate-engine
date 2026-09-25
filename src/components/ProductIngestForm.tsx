"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
        alert("Produk berhasil di-ingest! Engine sedang memproses di background.");
        router.refresh();
      } else {
        alert("Gagal menyimpan produk.");
      }
    } catch (error) {
      alert("Error submit: " + String(error));
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {/* Smart Scraper Field */}
      <div className="bg-indigo-950/30 p-3 rounded-xl border border-indigo-500/30">
        <label className="block text-xs font-bold text-indigo-300 mb-2">⚡ Auto-Scraper Shopee</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste link Shopee (s.shopee.co.id/...)"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            required
          />
          <button
            type="button"
            onClick={handleScrape}
            disabled={loading || !url}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
          >
            {loading ? "Scraping..." : "Tarik Data"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Produk (Bersih)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Contoh: Meja Lipat Portable"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Harga</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            placeholder="Contoh: 150000"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Gambar URL (Opsional)</label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="col-span-2 mt-2 pt-2 border-t border-slate-800">
          <label className="block text-xs font-bold text-amber-300 mb-1">🎯 Thematic Content Mode (Opsional)</label>
          <p className="text-[10px] text-slate-400 mb-2">Jika diisi, AI tidak akan me-review produk secara langsung, melainkan membuat tips/edukasi seputar tema ini, lalu menyelipkan produk di bagian akhir (Soft Selling).</p>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Contoh: Tips Mendekorasi Kamar Kost Sempit Agar Terlihat Estetik"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-amber-100 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 bg-slate-100 hover:bg-white text-slate-900 text-sm font-bold rounded-lg transition mt-4 disabled:opacity-50"
      >
        {submitting ? "Processing Pipeline..." : "Jalankan Auto-Pipeline"}
      </button>
    </form>
  );
}
