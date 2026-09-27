"use client";

import { useState } from "react";
import { Trash2, Sparkles, Loader2 } from "lucide-react";

export default function ProductCardActions({ productId }: { productId: string }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleGenerate = async () => {
    if (isGenerating || isDeleting) return;
    setIsGenerating(true);
    
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (data.success) {
        alert("✅ Berhasil generate dan menjadwalkan utas baru!");
        window.location.reload();
      } else {
        alert("❌ Gagal generate utas: " + (data.reason || data.error || "Terjadi kesalahan."));
      }
    } catch (err: any) {
      alert("❌ Terjadi kesalahan sistem: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (isGenerating || isDeleting) return;
    
    if (!confirm("Hapus produk ini beserta semua angle dan post yang terhubung? Tindakan ini tidak bisa dibatalkan.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      
      if (data.success) {
        window.location.reload();
      } else {
        alert("❌ Gagal menghapus: " + (data.error || "Terjadi kesalahan."));
        setIsDeleting(false);
      }
    } catch (err: any) {
      alert("❌ Terjadi kesalahan sistem: " + err.message);
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-3">
      <button
        onClick={handleGenerate}
        disabled={isGenerating || isDeleting}
        className="flex-1 py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs text-zinc-300 hover:text-white rounded border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors"
      >
        {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-yellow-500" />}
        <span>{isGenerating ? "Membuat..." : "Auto-Generate Utas"}</span>
      </button>

      <button
        onClick={handleDelete}
        disabled={isGenerating || isDeleting}
        className="py-1.5 px-3 bg-red-900/20 hover:bg-red-900/50 disabled:opacity-50 text-xs text-red-400 rounded border border-red-900/30 flex items-center justify-center transition-colors"
        title="Hapus Produk"
      >
        {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
      </button>
    </div>
  );
}
